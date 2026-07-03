/**
 * pages/AdminCompaniesPage.tsx
 *
 * Painel de gestão de empresas-cliente, acessível apenas a SUPER_ADMIN.
 * É a tela que substitui o terminal: listar, cadastrar (via onboarding
 * assistido), suspender e reativar empresas sem precisar de acesso
 * ao Railway ou rodar seed.ts manualmente.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Company, CompanyStatus, PlanTier } from '@valinexus/shared';
import { useCompanies } from '../hooks/useCompanies';
import { useAuth } from '../store/AuthContext';
import { OnboardCompanyModal } from '../components/modules/OnboardCompanyModal';

const STATUS_LABEL: Record<CompanyStatus, string> = {
  ACTIVE: 'Ativa', SUSPENDED: 'Suspensa', PENDING_DOCS: 'Pendente', INACTIVE: 'Inativa',
};
const STATUS_COLOR: Record<CompanyStatus, { bg: string; border: string; color: string }> = {
  ACTIVE:       { bg: '#0d3a1e', border: '#1a6b3a', color: '#4ade80' },
  SUSPENDED:    { bg: '#3a0a0a', border: '#991b1b', color: '#f87171' },
  PENDING_DOCS: { bg: '#3a2800', border: '#b45309', color: '#fbbf24' },
  INACTIVE:     { bg: '#1e1e2e', border: '#4a4a6a', color: '#a78bfa' },
};
const PLAN_LABEL: Record<PlanTier, string> = {
  STARTER: 'Starter', PROFESSIONAL: 'Professional', ENTERPRISE: 'Enterprise',
};

export default function AdminCompaniesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { companies, isLoading, error, onboard, suspend, reactivate, refresh } = useCompanies();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'ALL'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const filtered = companies.filter(c => {
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.razaoSocial.toLowerCase().includes(q) ||
      (c.nomeFantasia ?? '').toLowerCase().includes(q) || c.cnpj.includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: companies.length,
    active: companies.filter(c => c.status === CompanyStatus.ACTIVE).length,
    suspended: companies.filter(c => c.status === CompanyStatus.SUSPENDED).length,
    pending: companies.filter(c => c.status === CompanyStatus.PENDING_DOCS).length,
  };

  async function handleToggleStatus(company: Company) {
    setActionId(company.id);
    setActionError('');
    try {
      if (company.status === CompanyStatus.SUSPENDED) {
        await reactivate(company.id);
      } else {
        if (!window.confirm(`Suspender o acesso de "${company.razaoSocial}"? O cliente não conseguirá mais acessar o painel.`)) {
          setActionId(null);
          return;
        }
        await suspend(company.id);
      }
    } catch {
      setActionError('Erro ao atualizar status. Tente novamente.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070f0a', color: '#e2f0e8', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
        background: '#060d08', borderRight: '1px solid #0d2e14',
        display: 'flex', flexDirection: 'column', zIndex: 100,
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #0d2e14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: 'linear-gradient(135deg, #059669, #10b981)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>⛽</div>
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#10b981', letterSpacing: '1px' }}>VALINEXUS</div>
              <div style={{ fontSize: '10px', color: '#3d6b4a', letterSpacing: '0.5px' }}>Painel Admin</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '12px', flex: 1 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 12px', borderRadius: '8px', background: 'transparent',
              border: '1px solid transparent', color: '#5a9a68', fontSize: '13px',
              cursor: 'pointer', marginBottom: '6px', textAlign: 'left',
            }}
          >
            <span>← Voltar</span>
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
            borderRadius: '8px', background: '#0d2e14', border: '1px solid #1a5c28',
            color: '#10b981', fontSize: '13px', marginBottom: '2px',
          }}>
            <span>🏢</span><span>Empresas</span>
          </div>
        </nav>

        <div style={{ padding: '14px 16px', borderTop: '1px solid #0d2e14' }}>
          <div style={{ fontSize: '11px', color: '#3d6b4a', marginBottom: '3px' }}>OPERADOR</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#a7d9b2' }}>{user?.name}</div>
          <button onClick={logout} style={{
            marginTop: '10px', width: '100%', padding: '7px', borderRadius: '6px',
            background: 'transparent', border: '1px solid #1a3a22', color: '#3d6b4a', fontSize: '11px', cursor: 'pointer',
          }}>Sair</button>
        </div>
      </div>

      <div style={{ marginLeft: '220px' }}>

        <div style={{
          padding: '16px 32px', borderBottom: '1px solid #0d2e14', background: '#060d08',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Empresas Clientes</h1>
            <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '2px 0 0' }}>{counts.total} empresa(s) cadastrada(s)</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', cursor: 'pointer',
              boxShadow: '0 0 14px rgba(16,185,129,0.2)',
            }}
          >+ Cadastrar Empresa</button>
        </div>

        <div style={{ padding: '28px 32px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total', value: counts.total, color: '#10b981', bg: '#0a2818' },
              { label: 'Ativas', value: counts.active, color: '#4ade80', bg: '#061a0e' },
              { label: 'Pendentes', value: counts.pending, color: '#fbbf24', bg: '#1a0e00' },
              { label: 'Suspensas', value: counts.suspended, color: '#f87171', bg: '#1a0606' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '30px', fontWeight: 800, color: kpi.color, fontFamily: 'monospace' }}>{kpi.value}</div>
                <div style={{ fontSize: '12px', color: '#4a7a54', marginTop: '4px' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <input
              placeholder="Buscar por razão social, fantasia ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: '240px', padding: '9px 14px', borderRadius: '8px',
                background: '#060d08', border: '1px solid #1a5c28', color: '#e2f0e8', fontSize: '13px', outline: 'none',
              }}
            />
            {(['ALL', ...Object.values(CompanyStatus)] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{
                  padding: '7px 12px', borderRadius: '7px', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace',
                  background: statusFilter === s ? '#0d2e14' : 'transparent',
                  border: `1px solid ${statusFilter === s ? '#1a6b3a' : '#0d2e14'}`,
                  color: statusFilter === s ? '#4ade80' : '#3d6b4a',
                }}
              >{s === 'ALL' ? 'Todas' : STATUS_LABEL[s as CompanyStatus]}</button>
            ))}
          </div>

          {actionError && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', fontSize: '13px', color: '#f87171' }}>
              {actionError}
            </div>
          )}

          {isLoading && (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #0d2e14', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!isLoading && error && (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
              <button onClick={() => refresh()} style={{ padding: '9px 20px', borderRadius: '8px', background: 'transparent', border: '1px solid #1a5c28', color: '#4ade80', cursor: 'pointer', fontSize: '13px' }}>Tentar novamente</button>
            </div>
          )}

          {!isLoading && !error && (
            <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#3d6b4a', fontSize: '14px' }}>
                  {companies.length === 0
                    ? 'Nenhuma empresa cadastrada ainda. Clique em "+ Cadastrar Empresa" para começar.'
                    : 'Nenhuma empresa encontrada com esses filtros.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0a1a0e' }}>
                      {['Empresa', 'CNPJ', 'Plano', 'Status', 'Contato', ''].map(h => (
                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '10px', color: '#3d6b4a', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #0d2e14', fontFamily: 'monospace' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((company, i) => {
                      const statusStyle = STATUS_COLOR[company.status];
                      const isActing = actionId === company.id;
                      return (
                        <tr key={company.id} onClick={() => navigate(`/admin/companies/${company.id}`)} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #080f0a' : 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#0a1a0e')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2f0e8' }}>{company.razaoSocial}</div>
                            {company.nomeFantasia && <div style={{ fontSize: '11px', color: '#4a7a54' }}>{company.nomeFantasia}</div>}
                          </td>
                          <td style={{ padding: '13px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#4a7a54' }}>{company.cnpj}</td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#4ade80' }}>{PLAN_LABEL[company.planTier]}</span>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color, padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                              {STATUS_LABEL[company.status]}
                            </span>
                          </td>
                          <td style={{ padding: '13px 14px', fontSize: '12px', color: '#4a7a54' }}>{company.whatsapp}</td>
                          <td style={{ padding: '13px 14px' }}>
                            <button
                              onClick={() => handleToggleStatus(company)}
                              disabled={isActing}
                              style={{
                                padding: '5px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                                background: 'transparent',
                                border: `1px solid ${company.status === CompanyStatus.SUSPENDED ? '#1a5c28' : '#7f1d1d'}`,
                                color: isActing ? '#fbbf24' : company.status === CompanyStatus.SUSPENDED ? '#4ade80' : '#f87171',
                              }}
                            >{isActing ? '...' : company.status === CompanyStatus.SUSPENDED ? 'Reativar' : 'Suspender'}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      <OnboardCompanyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onboard}
      />
    </div>
  );
}
