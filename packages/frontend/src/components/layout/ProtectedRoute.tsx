/**
 * components/layout/ProtectedRoute.tsx
 *
 * Guard de rotas autenticadas. Enquanto o AuthContext verifica a sessão
 * (isLoading=true), exibe um loader. Se não autenticado, redireciona
 * para /login preservando a URL de destino (após login, volta para onde estava).
 *
 * Também intercepta usuários com mustChangePassword=true: nenhuma rota
 * protegida é acessível até a senha temporária ser trocada. Isso fecha
 * o ciclo do onboarding assistido — a senha gerada pelo seed.ts e
 * comunicada via WhatsApp tem validade de uso único.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050c07',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: '36px', height: '36px',
          border: '3px solid #0d2e14', borderTop: '3px solid #10b981',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#3d6b4a', letterSpacing: '2px' }}>
          VERIFICANDO SESSÃO...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Senha temporária ainda não trocada — bloqueia qualquer rota protegida
  // exceto a própria tela de troca de senha (evita loop de redirecionamento).
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
