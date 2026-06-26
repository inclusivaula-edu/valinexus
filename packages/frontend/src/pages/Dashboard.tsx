/**
 * Dashboard.tsx — v2
 *
 * Mudanças desta versão vs v1:
 * - Dados reais via useCertifications() — mocks removidos
 * - Modal de criação/edição integrado (CertificationFormModal)
 * - Botões "Editar", "Upload" e "Excluir" funcionais
 * - Estado de loading e erro da API tratados na UI
 * - daysLeft calculado no cliente a partir de expiresAt (não mais campo separado)
 * - useAuth() conectado: logout funcional, nome do usuário no header
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Certification, CertificationCategory, CreateCertificationDto, UpdateCertificationDto, UserRole } from '@valinexus/shared';
import { useCertifications } from '../hooks/useCertifications';
import { useAuth } from '../store/AuthContext';
import { CertificationFormModal } from '../components/modules/CertificationFormModal';
import { NotificationSettingsPanel } from '../components/modules/NotificationSettingsPanel';
import { certificationsApi } from '../services/certifications';

// ─── Utilitários ─────────────────────────────────────────────────────────────

type CertStatus = Certification['status'];
type Category = CertificationCategory;

function daysUntil(dateStr: string | Date): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const CATEGORY_LABEL: Record<string, string> = {
  FISCAL: 'Fiscal', TRABALHISTA: 'Trabalhista', SEGURANCA: 'Segurança',
  TECNICO: 'Técnico', PETROBRAS: 'Petrobras', SEGURO: 'Seguro',
  OPERACIONAL: 'Operacional', AMBIENTAL: 'Ambiental',
};

const CATEGORY_COLOR: Record<string, string> = {
  FISCAL: '#3b82f6', TRABALHISTA: '#8b5cf6', SEGURANCA: '#f59e0b',
  TECNICO: '#06b6d4', PETROBRAS: '#10b981', SEGURO: '#f97316',
  OPERACIONAL: '#ec4899', AMBIENTAL: '#84cc16',
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusBadge({ status, expiresAt }: { status: CertStatus; expiresAt: string | Date }) {
  const days = daysUntil(expiresAt);
  const cfg: Record<CertStatus, { bg: string; border: string; color: string; label: string }> = {
    VALID:          { bg: '#0d3a1e', border: '#1a6b3a', color: '#4ade80', label: 'Válida' },
    EXPIRING_SOON:  { bg: '#3a2800', border: '#b45309', color: '#fbbf24', label: `${days}d` },
    EXPIRED:        { bg: '#3a0a0a', border: '#991b1b', color: '#f87171', label: 'Vencida' },
    PENDING_UPLOAD: { bg: '#1e1e2e', border: '#4a4a6a', color: '#a78bfa', label: 'Pendente' },
    UNDER_REVIEW:   { bg: '#1a1a00', border: '#5a5a00', color: '#facc15', label: 'Em análise' },
  };
  const c = cfg[status] ?? cfg.VALID;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      padding: '3px 10px', borderRadius: '100px', fontSize: '11px',
      fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{c.label}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid #0d2e14', borderTop: '3px solid #10b981',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    certifications, dashboard, templates,
    isLoading, error,
    create, update, uploadFile, remove, refresh,
  } = useCertifications();

  const [activeTab, setActiveTab]   = useState<'overview' | 'certifications' | 'notifications'>('overview');
  const [filter, setFilter]         = useState<CertStatus | 'ALL'>('ALL');
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dados derivados
  const summary = dashboard?.certificationSummary ?? {
    total: certifications.length,
    valid: certifications.filter(c => c.status === 'VALID').length,
    expiringSoon: certifications.filter(c => c.status === 'EXPIRING_SOON').length,
    expired: certifications.filter(c => c.status === 'EXPIRED').length,
    pendingUpload: certifications.filter(c => c.status === 'PENDING_UPLOAD').length,
  };
  const score = dashboard?.complianceScore ?? (
    summary.total > 0 ? Math.round((summary.valid / summary.total) * 100) : 0
  );
  const criticals = certifications.filter(c =>
    c.status === 'EXPIRED' || daysUntil(c.expiresAt) <= 15
  ).sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));

  const filtered = certifications.filter(c => {
    const matchStatus = filter === 'ALL' || c.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.issuingBody.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Handlers
  function openCreate() { setEditingCert(null); setModalOpen(true); }
  function openEdit(cert: Certification) { setEditingCert(cert); setModalOpen(true); }

  async function handleFormSubmit(dto: CreateCertificationDto, file?: File) {
    if (editingCert) {
      const { companyId: _, ...updateDto } = dto;
      const updated = await update(editingCert.id, updateDto as UpdateCertificationDto);
      if (file) return await uploadFile(updated.id, file);
    } else {
      const created = await create(dto);
      if (file) return await uploadFile(created.id, file);
    }
    return null;
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir esta certidão? Esta ação não pode ser desfeita.')) return;
    setDeletingId(id);
    setActionError('');
    try {
      await remove(id);
    } catch {
      setActionError('Erro ao excluir. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  }

  function triggerUpload(certId: string) {
    setUploadingId(certId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    e.target.value = '';
    setActionError('');
    try {
      await uploadFile(uploadingId, file);
    } catch {
      setActionError('Erro no upload. Verifique o arquivo e tente novamente.');
    } finally {
      setUploadingId(null);
    }
  }

  /**
   * Busca uma URL pré-assinada FRESCA antes de abrir o documento.
   * A URL salva em cert.fileUrl pode ter expirado (válida só por 15min),
   * então sempre pedimos uma nova ao backend no momento do clique.
   */
  async function openFile(certId: string) {
    setOpeningFileId(certId);
    setActionError('');
    try {
      const url = await certificationsApi.getDownloadUrl(certId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setActionError('Erro ao abrir documento. Tente novamente.');
    } finally {
      setOpeningFileId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#070f0a', color: '#e2f0e8', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* Input de arquivo oculto — acionado pelos botões de Upload da tabela */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
        background: '#060d08', borderRight: '1px solid #0d2e14',
        display: 'flex', flexDirection: 'column', zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #0d2e14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>⛽</div>
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#10b981', letterSpacing: '1px' }}>
                VALINEXUS
              </div>
              <div style={{ fontSize: '10px', color: '#3d6b4a', letterSpacing: '0.5px' }}>Macapá · AP</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px', flex: 1 }}>
          {([
            { id: 'overview',        icon: '📊', label: 'Visão Geral' },
            { id: 'certifications',  icon: '📄', label: 'Certidões' },
            { id: 'notifications',   icon: '🔔', label: 'Alertas' },
            { id: 'logistics',       icon: '🚛', label: 'Logística',  disabled: true },
            { id: 'financial',       icon: '💰', label: 'Financeiro', disabled: true },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => !item.disabled && setActiveTab(item.id as typeof activeTab)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                background: activeTab === item.id ? '#0d2e14' : 'transparent',
                border: activeTab === item.id ? '1px solid #1a5c28' : '1px solid transparent',
                color: item.disabled ? '#1e3a22' : activeTab === item.id ? '#10b981' : '#5a9a68',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: '13px', textAlign: 'left', marginBottom: '2px',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.disabled && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#1e3a22' }}>BREVE</span>}
            </button>
          ))}
        </nav>

        {/* Painel interno — visível apenas para a equipe VALINEXUS */}
        {user?.role === UserRole.SUPER_ADMIN && (
          <div style={{ padding: '0 12px 12px' }}>
            <button
              onClick={() => navigate('/admin/companies')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '9px 12px', borderRadius: '8px',
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24', fontSize: '13px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>🏢</span><span>Painel de Empresas</span>
            </button>
          </div>
        )}

        {/* Empresa + compliance */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid #0d2e14' }}>
          <div style={{ fontSize: '11px', color: '#3d6b4a', marginBottom: '3px' }}>EMPRESA</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#a7d9b2', marginBottom: '2px' }}>
            {user?.name ?? '—'}
          </div>
          <div style={{
            marginTop: '10px', padding: '6px 10px', borderRadius: '6px',
            background: score >= 80 ? '#0a2e14' : score >= 60 ? '#2a1a00' : '#2a0a0a',
            border: `1px solid ${score >= 80 ? '#1a6b3a' : score >= 60 ? '#b45309' : '#991b1b'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', color: '#5a9a68' }}>Conformidade</span>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '14px',
              color: score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : '#f87171',
            }}>{score}%</span>
          </div>
          <button
            onClick={() => navigate('/change-password')}
            style={{
              marginTop: '10px', width: '100%', padding: '7px', borderRadius: '6px',
              background: 'transparent', border: '1px solid #1a3a22',
              color: '#3d6b4a', fontSize: '11px', cursor: 'pointer',
            }}
          >🔑 Trocar senha</button>
          <button
            onClick={logout}
            style={{
              marginTop: '6px', width: '100%', padding: '7px', borderRadius: '6px',
              background: 'transparent', border: '1px solid #1a3a22',
              color: '#3d6b4a', fontSize: '11px', cursor: 'pointer',
            }}
          >Sair</button>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: '220px' }}>

        {/* Header */}
        <div style={{
          padding: '16px 32px', borderBottom: '1px solid #0d2e14',
          background: '#060d08', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#e2f0e8', margin: 0 }}>
              {activeTab === 'overview' ? 'Visão Geral' : activeTab === 'certifications' ? 'Certidões' : 'Configurar Alertas'}
            </h1>
            <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '2px 0 0' }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {actionError && (
              <span style={{ fontSize: '12px', color: '#f87171', maxWidth: '220px' }}>{actionError}</span>
            )}
            <button
              onClick={refresh}
              style={{
                padding: '7px 12px', borderRadius: '7px', fontSize: '12px',
                background: 'transparent', border: '1px solid #0d2e14', color: '#3d6b4a', cursor: 'pointer',
              }}
              title="Recarregar dados"
            >↻</button>
            <button
              onClick={openCreate}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none', color: '#fff', cursor: 'pointer',
                boxShadow: '0 0 14px rgba(16,185,129,0.2)',
              }}
            >+ Nova Certidão</button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && <Spinner />}

        {/* Error state */}
        {!isLoading && error && (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
            <button onClick={refresh} style={{
              padding: '9px 20px', borderRadius: '8px', background: 'transparent',
              border: '1px solid #1a5c28', color: '#4ade80', cursor: 'pointer', fontSize: '13px',
            }}>Tentar novamente</button>
          </div>
        )}

        {/* ── Tab: Visão Geral ── */}
        {!isLoading && !error && activeTab === 'overview' && (
          <div style={{ padding: '28px 32px' }}>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {[
                { label: 'Total', value: summary.total,        icon: '📋', color: '#10b981', bg: '#0a2818' },
                { label: 'Válidas', value: summary.valid,       icon: '✅', color: '#4ade80', bg: '#061a0e' },
                { label: 'A Vencer (30d)', value: summary.expiringSoon, icon: '⏳', color: '#fbbf24', bg: '#1a0e00' },
                { label: 'Vencidas', value: summary.expired,   icon: '🔴', color: '#f87171', bg: '#1a0606' },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: kpi.bg, border: `1px solid ${kpi.color}22`,
                  borderRadius: '12px', padding: '20px',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>{kpi.icon}</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: kpi.color, lineHeight: 1, fontFamily: 'monospace' }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: '12px', color: '#4a7a54', marginTop: '6px' }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Alertas críticos */}
            {criticals.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#9ab5a0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                  ⚠️ Requer atenção imediata
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {criticals.map(cert => (
                    <div key={cert.id} style={{
                      padding: '14px 18px', borderRadius: '10px',
                      background: cert.status === 'EXPIRED' ? '#1a0606' : '#1a0e00',
                      border: `1px solid ${cert.status === 'EXPIRED' ? '#7f1d1d' : '#92400e'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2f0e8' }}>{cert.name}</div>
                        <div style={{ fontSize: '12px', color: '#4a7a54', marginTop: '2px' }}>{cert.issuingBody}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <StatusBadge status={cert.status} expiresAt={cert.expiresAt} />
                        <button
                          onClick={() => openEdit(cert)}
                          style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                            background: 'transparent',
                            border: cert.status === 'EXPIRED' ? '1px solid #7f1d1d' : '1px solid #92400e',
                            color: cert.status === 'EXPIRED' ? '#f87171' : '#fbbf24', cursor: 'pointer',
                          }}>Renovar →</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Distribuição por categoria */}
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#9ab5a0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              Por categoria
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {Object.keys(CATEGORY_LABEL).map(cat => {
                const certs = certifications.filter(c => c.category === cat);
                if (certs.length === 0) return null;
                const validCount = certs.filter(c => c.status === 'VALID').length;
                const pct = Math.round((validCount / certs.length) * 100);
                return (
                  <div key={cat} style={{
                    background: '#060d08', border: '1px solid #0d2e14', borderRadius: '10px', padding: '14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                        background: `${CATEGORY_COLOR[cat]}22`, color: CATEGORY_COLOR[cat], letterSpacing: '0.5px',
                      }}>{CATEGORY_LABEL[cat].toUpperCase()}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a7a54' }}>{certs.length}</span>
                    </div>
                    <div style={{ height: '4px', background: '#0d2e14', borderRadius: '100px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: '100px',
                        background: pct === 100 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#3d6b4a', marginTop: '5px' }}>{pct}% em dia</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Certidões ── */}
        {!isLoading && !error && activeTab === 'certifications' && (
          <div style={{ padding: '28px 32px' }}>

            {/* Barra de filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                placeholder="Buscar certidão ou órgão emissor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, minWidth: '220px', padding: '9px 14px', borderRadius: '8px',
                  background: '#060d08', border: '1px solid #1a5c28', color: '#e2f0e8',
                  fontSize: '13px', outline: 'none',
                }}
              />
              {(['ALL', 'EXPIRED', 'EXPIRING_SOON', 'VALID', 'PENDING_UPLOAD'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '7px 12px', borderRadius: '7px', fontSize: '11px', cursor: 'pointer',
                    background: filter === f ? '#0d2e14' : 'transparent',
                    border: `1px solid ${filter === f ? '#1a6b3a' : '#0d2e14'}`,
                    color: filter === f ? '#4ade80' : '#3d6b4a', fontFamily: 'monospace',
                  }}
                >{{ ALL: 'Todas', EXPIRED: '🔴 Vencidas', EXPIRING_SOON: '⏳ A Vencer', VALID: '✅ Válidas', PENDING_UPLOAD: '📤 Pendentes' }[f]}</button>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ background: '#060d08', border: '1px solid #0d2e14', borderRadius: '12px', overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#3d6b4a', fontSize: '14px' }}>
                  {search || filter !== 'ALL'
                    ? 'Nenhuma certidão encontrada com esses filtros.'
                    : 'Nenhuma certidão cadastrada. Clique em "+ Nova Certidão" para começar.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0a1a0e' }}>
                      {['Certidão', 'Categoria', 'Órgão Emissor', 'Vencimento', 'Status', 'Arquivo', 'Ações'].map(h => (
                        <th key={h} style={{
                          padding: '11px 14px', textAlign: 'left', fontSize: '10px',
                          color: '#3d6b4a', fontWeight: 600, letterSpacing: '1px',
                          textTransform: 'uppercase', borderBottom: '1px solid #0d2e14',
                          fontFamily: 'monospace', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((cert, i) => {
                      const isDeleting = deletingId === cert.id;
                      const isUploading = uploadingId === cert.id;
                      return (
                        <tr
                          key={cert.id}
                          style={{
                            borderBottom: i < filtered.length - 1 ? '1px solid #080f0a' : 'none',
                            background: cert.status === 'EXPIRED'
                              ? 'rgba(248,113,113,0.03)'
                              : isDeleting ? 'rgba(248,113,113,0.06)' : 'transparent',
                            opacity: isDeleting ? 0.5 : 1,
                            transition: 'opacity 0.2s',
                          }}
                        >
                          <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#d4e8d9', lineHeight: 1.4 }}>
                              {cert.name}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                              background: `${CATEGORY_COLOR[cert.category]}18`,
                              color: CATEGORY_COLOR[cert.category], fontFamily: 'monospace',
                            }}>{CATEGORY_LABEL[cert.category]}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4a7a54', whiteSpace: 'nowrap' }}>
                            {cert.issuingBody}
                          </td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#4a7a54', whiteSpace: 'nowrap' }}>
                            {new Date(cert.expiresAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <StatusBadge status={cert.status} expiresAt={cert.expiresAt} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {cert.fileUrl ? (
                              <button
                                onClick={() => openFile(cert.id)}
                                disabled={openingFileId === cert.id}
                                style={{
                                  fontSize: '12px', color: openingFileId === cert.id ? '#fbbf24' : '#10b981',
                                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                  textDecoration: 'underline', textDecorationStyle: 'dotted',
                                }}
                              >{openingFileId === cert.id ? '⏳ Abrindo...' : '📎 Ver arquivo'}</button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#2a4a30' }}>— sem arquivo</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                              {/* Editar */}
                              <button
                                onClick={() => openEdit(cert)}
                                disabled={isDeleting}
                                style={{
                                  padding: '4px 10px', borderRadius: '5px', fontSize: '11px',
                                  background: 'transparent', border: '1px solid #1a5c28',
                                  color: '#4ade80', cursor: 'pointer',
                                }}
                                title="Editar certidão"
                              >✏️</button>

                              {/* Upload */}
                              <button
                                onClick={() => triggerUpload(cert.id)}
                                disabled={isDeleting || isUploading}
                                style={{
                                  padding: '4px 10px', borderRadius: '5px', fontSize: '11px',
                                  background: 'transparent', border: '1px solid #1a3a28',
                                  color: isUploading ? '#fbbf24' : '#3d7a54', cursor: 'pointer',
                                }}
                                title="Fazer upload do documento"
                              >{isUploading ? '⏳' : '📤'}</button>

                              {/* Excluir */}
                              <button
                                onClick={() => handleDelete(cert.id)}
                                disabled={isDeleting}
                                style={{
                                  padding: '4px 10px', borderRadius: '5px', fontSize: '11px',
                                  background: 'transparent', border: '1px solid #3a0a0a',
                                  color: '#7f1d1d', cursor: 'pointer',
                                }}
                                title="Excluir certidão"
                              >{isDeleting ? '...' : '🗑️'}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#3d6b4a', fontFamily: 'monospace' }}>
              {filtered.length} de {certifications.length} certidão(ões)
            </div>
          </div>
        )}

      {/* ── Tab: Alertas ── */}
        {!isLoading && !error && activeTab === 'notifications' && (
          <div style={{ padding: '28px 32px' }}>
            <NotificationSettingsPanel />
          </div>
        )}

      </div>

      {/* ── Modal de criação/edição ── */}
      <CertificationFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCert(null); }}
        onSubmit={handleFormSubmit}
        editingCert={editingCert}
        templates={templates}
        companyId={user?.companyId ?? ''}
      />

    </div>
  );
}
