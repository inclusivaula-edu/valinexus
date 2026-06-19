/**
 * services/api.ts — Cliente HTTP com renovação automática de token
 *
 * O interceptor de resposta resolve o maior problema de UX com JWT:
 * o usuário está trabalhando, o access token expira (15min), e a
 * próxima request falha com 401. Sem interceptor: tela em branco ou
 * erro. Com interceptor: o token é renovado silenciosamente, a request
 * original é repetida, e o usuário não percebe nada.
 *
 * Fluxo do interceptor:
 * 1. Request falha com 401
 * 2. Tenta POST /auth/refresh (com cookie httpOnly automático)
 * 3. Se refresh OK → atualiza o access token na memória → repete request original
 * 4. Se refresh falhou → redireciona para login
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// Token em memória — NUNCA em localStorage (vulnerável a XSS)
// NUNCA em cookie acessível por JS — só o refreshToken vai em cookie httpOnly
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Flag para evitar múltiplos refreshes simultâneos
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshQueue.forEach(cb => cb(token));
  refreshQueue = [];
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // envia cookies httpOnly automaticamente (refreshToken)
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor de REQUEST: injeta o access token em todo request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Interceptor de RESPONSE: renova o token automaticamente em 401
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    const is401 = error.response?.status === 401;
    const isRefreshRoute = originalRequest.url?.includes('/auth/refresh');
    const alreadyRetried = originalRequest._retry;

    if (is401 && !isRefreshRoute && !alreadyRetried) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Outra request já está fazendo o refresh — entra na fila
        return new Promise(resolve => {
          refreshQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken: string = data.data.accessToken;
        setAccessToken(newToken);
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh falhou — sessão encerrada, redireciona para login
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
