import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Company, CompanyStatus, Certification, CertificationCategory, CertificationStatus, CreateCertificationDto, UpdateCertificationDto } from '@valinexus/shared';
import { companiesApi, CompanyUser, CompanyUsageStats } from '../services/companies';
import { certificationsApi } from '../services/certifications';
import { useAuth } from '../store/AuthContext';
import { CertificationFormModal } from '../components/modules/CertificationFormModal';

const STATUS_LABEL: Record<CompanyStatus, string> = {
  ACTIVE: 'Ativa', SUSPENDED: 'Suspensa', PENDING_DOCS: 'Pendente', INACTIVE: 'Inativa',
};
const STATUS_COLOR: Record<CompanyStatus, { bg: string; border: string; color: string }> = {
  ACTIVE:       { bg: '#0d3a1e', border: '#1a6b3a', color: '#4ade80' },
  SUSPENDED:    { bg: '#3a0a0a', border: '#991b1b', color: '#f87171' },
  PENDING_DOCS: { bg: '#3a2800', border: '#b45309', color: '#fbbf24' },
  INACTIVE:     { bg: '#1e1e2e', border: '#4a4a6a', color: '#a78bfa' },
};
const CERT_STATUS_LABEL: Record<string, string> = {
  VALID: 'Válida', EXPIRING_SOON: 'Vencendo', EXPIRED: 'Vencida',
  PENDING_UPLOAD: 'Pendente', UNDER_REVIEW: 'Em Análise',
};
const CERT_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  VALID:          { bg: '#0d3a1e', color: '#4ade80' },
  EXPIRING_SOON:  { bg: '#3a2800', color: '#fbbf24' },
  EXPIRED:        { bg: '#3a0a0a', color: '#f87171' },
  PENDING_UPLOAD: { bg: '#1e1e2e', color: '#a78bfa' },
  UNDER_REVIEW:   { bg: '#0a1a3a', color: '#60a5fa' },
};
const CATEGORY_LABEL: Record<string, string> = {
  FISCAL: 'Fiscal', TRABALHISTA: 'Trabalhista', SEGURANCA: 'Segurança',
  TECNICO: 'Técnico', PETROBRAS: 'Petrobras', SEGURO: 'Seguro',
  OPERACIONAL: 'Operacional', AMBIENTAL: 'Ambiental',
};

function daysUntil(dateStr: string | Date): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [stats, setStats] = useState<CompanyUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'certs' | 'users' | 'info'>('certs');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      companiesApi.getById(id),
      certificationsApi.list(id),
      companiesApi.listUsers(id),
      companiesApi.getUsageStats(id),
    ])
      .then(([comp, certList, userList, usageStats]) => {
        setCompany(comp);
        setCerts(certList);
        setUsers(userList);
        setStats(usageStats);
      })
      .catch(() => setError('Erro ao carregar dados da empresa.'))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadCerts = useCallback(async () => {
    if (!id) return;
    const certList = await certificationsApi.list(id);
    setCerts(certList);
  }, [id]);

  async function handleCertSubmit(dto: CreateCertificationDto, file?: File) {
    let cert: Certification;
    if (editingCert) {
      cert = await certificationsApi.update(editingCert.id, dto as UpdateCertificationDto);
      setCerts(prev => prev.map(c => c.id === editingCert.id ? cert : c));
    } else {
      cert = await certificationsApi.create({ ...dto, companyId: id! });
      await reloadCerts();
    }
    if (file) {
      const result = await certificationsApi.uploadFile(cert.id, file);
      await reloadCerts();
      setModalOpen(false);
      setEditingCert(null);
      return result.extracted;
    }
    setModalOpen(false);
    setEditingCert(null);
    return null;
  }

  async function handleDelete(certId: string) {
    if (!window.confirm('Excluir esta certidão? Esta ação não pode ser desfeita.')) return;
    setActionId(certId);
    setActionError('');
    try {
      await certificationsApi.delete(certId);
      setCerts(prev => prev.filter(c => c.id !== certId));
    } catch {
      setActionError('Erro ao excluir certidão.');
    } finally {
      setActionId(null);
    }
  }

  function handleUploadClick(certId: string) {
    setUploadTargetId(certId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    setActionId(uploadTargetId);
    setActionError('');
    try {
      await certificationsApi.uploadFile(uploadTargetId, file);
      await reloadCerts();
    } catch {
      setActionError('Erro ao enviar arquivo.');
    } finally {
      setActionId(null);
      setUploadTargetId(null);
      e.target.value = '';
    }
  }

  const certSummary = {
    total: certs.length,
    valid: certs.filter(c => c.status === CertificationStatus.VALID).length,
    expiring: certs.filter(c => c.status === CertificationStatus.EXPIRING_SOON).length,
    expired: certs.filter(c => c.status === CertificationStatus.EXPIRED).length,
    pending: certs.filter(c => c.status === CertificationStatus.PENDING_UPLOAD).length,
  };

  const complianceScore = certSummary.total > 0
    ? Math.round((certSummary.valid / certSummary.total) * 100)
    : 0;

  const scoreColor = complianceScore >= 80 ? '#4ade80' : complianceScore >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div style={{ minHeight: '100vh', background: '#070f0a', color: '#e2f0e8', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* Sidebar */}
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
              <div style={{ fontSize: '10px', color: '#3d6b4a', letterSpacing: '0.5px' }}>Detalhe Empresa</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '12px', flex: 1 }}>
          <button onClick={() => navigate('/admin/companies')} style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            padding: '9px 12px', borderRadius: '8px', background: 'transparent',
            border: '1px solid transparent', color: '#5a9a68', fontSize: '13px',
            cursor: 'pointer', marginBottom: '6px', textAlign: 'left',
          }}>
            <span>← Empresas</span>
          </button>
          {([
            { id: 'certs' as const, icon: '📄', label: 'Certidões' },
            { id: 'users' as const, icon: '👥', label: 'Usuários' },
            { id: 'info' as const,  icon: '🏢', label: 'Dados' },
          ]).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 12px', borderRadius: '8px',
              background: activeTab === item.id ? '#0d2e14' : 'transparent',
              border: activeTab === item.id ? '1px solid #1a5c28' : '1px solid transparent',
              color: activeTab === item.id ? '#10b981' : '#5a9a68',
              cursor: 'pointer', fontSize: '13px', textAlign: 'left', marginBottom: '2px',
            }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
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

      {/* Main */}
      <div style={{ marginLeft: '220px' }}>

        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileSelected} />

        {/* Header */}
        <div style={{
          padding: '16px 32px', borderBottom: '1px solid #0d2e14', background: '#060d08',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
              {company?.razaoSocial ?? 'Carregando...'}
            </h1>
            <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '2px 0 0' }}>
              {company?.cnpj} {company?.nomeFantasia ? `· ${company.nomeFantasia}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {company && activeTab === 'certs' && (
              <button onClick={() => { setEditingCert(null); setModalOpen(true); }} style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', cursor: 'pointer',
                boxShadow: '0 0 14px rgba(16,185,129,0.2)',
              }}>+ Certidão</button>
            )}
            {company && (
              <span style={{
                ...STATUS_COLOR[company.status],
                padding: '4px 14px', borderRadius: '100px', fontSize: '11px',
                fontFamily: 'monospace', fontWeight: 600,
                border: `1px solid ${STATUS_COLOR[company.status].border}`,
              }}>
                {STATUS_LABEL[company.status]}
              </span>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #0d2e14', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ margin: '28px 32px', padding: '14px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {!loading && !error && company && (
          <div style={{ padding: '28px 32px' }}>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Compliance', value: `${complianceScore}%`, color: scoreColor, bg: '#0a1a0e' },
                { label: 'Válidas', value: certSummary.valid, color: '#4ade80', bg: '#061a0e' },
                { label: 'Vencendo', value: certSummary.expiring, color: '#fbbf24', bg: '#1a0e00' },
                { label: 'Vencidas', value: certSummary.expired, color: '#f87171', bg: '#1a0606' },
                { label: 'Pendentes', value: certSummary.pending, color: '#a78bfa', bg: '#0e0a1e' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: kpi.color, fontFamily: 'monospace' }}>{kpi.value}</div>
                  <div style={{ fontSize: '11px', color: '#4a7a54', marginTop: '4px' }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {actionError && (
              <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', fontSize: '13px', color: '#f87171' }}>
                {actionError}
              </div>
            )}

            {/* Tab: Certidões */}
            {activeTab === 'certs' && (
              <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', overflow: 'hidden' }}>
                {certs.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#3d6b4a', fontSize: '14px' }}>
                    Nenhuma certidão cadastrada. Clique em "+ Certidão" para adicionar.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0a1a0e' }}>
                        {['Certidão', 'Categoria', 'Vencimento', 'Status', 'Dias', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '10px', color: '#3d6b4a', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #0d2e14', fontFamily: 'monospace' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {certs.map((cert, i) => {
                        const days = cert.expiresAt ? daysUntil(cert.expiresAt) : null;
                        const sc = CERT_STATUS_COLOR[cert.status] ?? { bg: '#1e1e2e', color: '#a78bfa' };
                        const isActing = actionId === cert.id;
                        return (
                          <tr key={cert.id} style={{ borderBottom: i < certs.length - 1 ? '1px solid #080f0a' : 'none' }}>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2f0e8' }}>{cert.name}</div>
                              <div style={{ fontSize: '11px', color: '#4a7a54' }}>{cert.issuingBody}{cert.documentNumber ? ` · N.º ${cert.documentNumber}` : ''}</div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#4ade80', fontFamily: 'monospace' }}>
                                {CATEGORY_LABEL[cert.category] ?? cert.category}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4a7a54', fontFamily: 'monospace' }}>
                              {cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                                {CERT_STATUS_LABEL[cert.status] ?? cert.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px', color: days !== null && days < 0 ? '#f87171' : days !== null && days < 30 ? '#fbbf24' : '#4a7a54' }}>
                              {days !== null ? (days < 0 ? `${Math.abs(days)}d atrás` : `${days}d`) : '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button title="Editar" disabled={isActing} onClick={() => { setEditingCert(cert); setModalOpen(true); }} style={{
                                  background: 'transparent', border: '1px solid #1a5c28', borderRadius: '6px',
                                  color: '#4ade80', cursor: 'pointer', padding: '4px 8px', fontSize: '12px',
                                }}>✏️</button>
                                <button title="Upload" disabled={isActing} onClick={() => handleUploadClick(cert.id)} style={{
                                  background: 'transparent', border: '1px solid #1a5c28', borderRadius: '6px',
                                  color: '#60a5fa', cursor: 'pointer', padding: '4px 8px', fontSize: '12px',
                                }}>{isActing && uploadTargetId === cert.id ? '...' : '📎'}</button>
                                <button title="Excluir" disabled={isActing} onClick={() => handleDelete(cert.id)} style={{
                                  background: 'transparent', border: '1px solid #3a0a0a', borderRadius: '6px',
                                  color: '#f87171', cursor: 'pointer', padding: '4px 8px', fontSize: '12px',
                                }}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Usuários */}
            {activeTab === 'users' && (
              <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', overflow: 'hidden' }}>
                {users.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#3d6b4a', fontSize: '14px' }}>
                    Nenhum usuário cadastrado.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0a1a0e' }}>
                        {['Nome', 'E-mail', 'Papel', 'Status', 'Último Login'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '10px', color: '#3d6b4a', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '1px solid #0d2e14', fontFamily: 'monospace' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #080f0a' : 'none' }}>
                          <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600 }}>{u.name}</td>
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4a7a54' }}>{u.email}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: u.role === 'SUPER_ADMIN' ? 'rgba(248,113,113,0.1)' : 'rgba(16,185,129,0.1)', color: u.role === 'SUPER_ADMIN' ? '#f87171' : '#4ade80', fontFamily: 'monospace' }}>
                              {u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'COMPANY_ADMIN' ? 'Admin' : 'Operador'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: '11px', padding: '3px 10px', borderRadius: '100px', fontFamily: 'monospace', fontWeight: 600,
                              background: u.isActive ? '#0d3a1e' : '#3a0a0a',
                              color: u.isActive ? '#4ade80' : '#f87171',
                            }}>
                              {u.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4a7a54', fontFamily: 'monospace' }}>
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Dados da Empresa */}
            {activeTab === 'info' && company && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '13px', color: '#3d6b4a', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 0, marginBottom: '16px' }}>DADOS CADASTRAIS</h3>
                  {([
                    ['Razão Social', company.razaoSocial],
                    ['Nome Fantasia', company.nomeFantasia ?? '—'],
                    ['CNPJ', company.cnpj],
                    ['E-mail', company.email],
                    ['Telefone', company.phone],
                    ['WhatsApp', company.whatsapp],
                    ['CRC Petrobras', company.crcPetrobrasCode ?? '—'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', color: '#3d6b4a', fontFamily: 'monospace', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', color: '#e2f0e8' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', padding: '24px' }}>
                    <h3 style={{ fontSize: '13px', color: '#3d6b4a', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 0, marginBottom: '16px' }}>ENDEREÇO</h3>
                    <div style={{ fontSize: '13px', color: '#e2f0e8', lineHeight: 1.6 }}>
                      {company.address.street}, {company.address.number}
                      {company.address.complement ? ` — ${company.address.complement}` : ''}
                      <br />{company.address.neighborhood}
                      <br />{company.address.city} / {company.address.state}
                      <br />{company.address.zipCode}
                    </div>
                  </div>

                  <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', padding: '24px' }}>
                    <h3 style={{ fontSize: '13px', color: '#3d6b4a', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 0, marginBottom: '16px' }}>PLANO & STATUS</h3>
                    {([
                      ['Plano', company.planTier],
                      ['Expira em', company.planExpiresAt ? new Date(company.planExpiresAt).toLocaleDateString('pt-BR') : '—'],
                      ['Categorias', (company.serviceCategories ?? []).join(', ') || '—'],
                      ['Cadastrada em', new Date(company.createdAt).toLocaleDateString('pt-BR')],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#3d6b4a', fontFamily: 'monospace', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '13px', color: '#e2f0e8' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && id && (
        <CertificationFormModal
          companyId={id}
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingCert(null); }}
          onSubmit={handleCertSubmit}
          editingCert={editingCert ?? undefined}
        />
      )}
    </div>
  );
}
