/**
 * store/AuthContext.tsx — Estado global de autenticação
 *
 * Context API em vez de Redux para auth: o estado de auth muda raramente
 * (login/logout) e é simples o suficiente para não justificar Redux.
 *
 * O AuthProvider:
 * - Ao montar, tenta renovar a sessão via /auth/refresh (cookie httpOnly)
 *   → usuário que fechou o browser volta logado automaticamente
 * - Expõe login(), logout(), refreshUser() e o objeto user para a árvore
 * - mustChangePassword no user é o que ativa o ForcePasswordChange guard
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken } from '../services/api';
import { UserRole } from '@valinexus/shared';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  mustChangePassword: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;  // true durante a hidratação inicial
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-busca os dados do usuário no backend — usado após trocar a senha */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// O backend retorna o payload de /auth/me com `userId`, não `id`.
// Normalizamos aqui para o resto do frontend usar sempre `id` — consistente
// com o resto do sistema (Company, Certification, etc. usam `id`).
function normalizeUser(raw: {
  userId: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}): AuthUser {
  return {
    id: raw.userId,
    companyId: raw.companyId,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    mustChangePassword: raw.mustChangePassword,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    async function hydrate() {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.data.accessToken);

        const { data: meData } = await api.get('/auth/me');
        setState({ user: normalizeUser(meData.data), isLoading: false, isAuthenticated: true });
      } catch {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    }
    hydrate();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.data.accessToken);
    // O payload de /auth/login já vem com mustChangePassword e id corretos
    setState({ user: data.data.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  /**
   * Re-busca os dados do usuário no backend sem afetar isLoading/isAuthenticated.
   * Usado após a troca de senha bem-sucedida: o backend revoga as sessões
   * (changePassword limpa o cookie), então aqui só atualizamos mustChangePassword
   * localmente — a troca de senha real já forçou um novo login no fluxo.
   */
  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setState(prev => ({ ...prev, user: normalizeUser(data.data) }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
