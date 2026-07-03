import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { UserRole } from '@valinexus/shared';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import RegulatoryChangesPage from './pages/RegulatoryChangesPage';

function ChangePasswordRoute() {
  const { user } = useAuth();
  return <ChangePasswordPage mandatory={!!user?.mustChangePassword} />;
}

/**
 * Guard adicional para rotas exclusivas de SUPER_ADMIN.
 * Diferente do ProtectedRoute (que só checa autenticação), este checa
 * o papel do usuário — um COMPANY_ADMIN autenticado não acessa /admin/*.
 */
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== UserRole.SUPER_ADMIN) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordRoute />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Painel interno VALINEXUS — só SUPER_ADMIN */}
          <Route
            path="/admin/companies"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <AdminCompaniesPage />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/companies/:id"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <CompanyDetailPage />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/regulatory-changes"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <RegulatoryChangesPage />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
