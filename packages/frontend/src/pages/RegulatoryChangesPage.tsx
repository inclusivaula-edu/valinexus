import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { regulatoryApi, RegulatoryChange } from '../services/regulatory';

const TYPE_META: Record<RegulatoryChange['changeType'], { label: string; color: string; icon: string }> = {
  NEW_REQUIREMENT:     { label: 'Nova Exigência',    color: '#ef4444', icon: '🆕' },
  UPDATED_REQUIREMENT: { label: 'Exigência Alterada', color: '#f59e0b', icon: '✏️' },
  REMOVED_REQUIREMENT: { label: 'Exigência Removida', color: '#a78bfa', icon: '🗑️' },
  CONTENT_CHANGE:      { label: 'Mudança de Conteúdo', color: '#60a5fa', icon: '📄' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RegulatoryChangesPage() {
  const { user, logout } = useAuth();
  const [changes, setChanges] = useState<RegulatoryChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await regulatoryApi.list();
      setChanges(data);
    } catch {
      setError('Erro ao carregar mudanças regulatórias. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReview(id: string) {
    setReviewingId(id);
    try {
      await regulatoryApi.markReviewed(id, actionNote.trim() || undefined);
      setChanges(prev => prev.map(c => c.id === id
        ? { ...c, reviewed: true, reviewedAt: new Date().toISOString(), actionTaken: actionNote.trim() || null }
        : c
      ));
      setActionId(null);
      setActionNote('');
    } catch {
      setError('Erro ao marcar como revisado.');
    } finally {
      setReviewingId(null);
    }
  }

  const filtered = changes.filter(c => {
    if (filter === 'PENDING')  return !c.reviewed;
    if (filter === 'REVIEWED') return c.reviewed;
    return true;
  });

  const pendingCount = changes.filter(c => !c.reviewed).length;

  // ── Estilos reutilizados ──────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: '#0d1f0f', border: '1px solid #1a3a22', borderRadius: '12px',
    padding: '18px 20px', marginBottom: '10px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    background: '#0a1a0e', border: '1px solid #1a5c28',
    color: '#e2f0e8', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060d08', color: '#e2f0e8' }}>

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,13,8,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #0d2e14', padding: '0 24px',
      }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/admin/companies" style={{ color: '#5a9a68', textDecoration: 'none', fontSize: '13px' }}>← Empresas</a>
            <span style={{ color: '#1a3a22' }}>|</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', letterSpacing: '1px' }}>
              🔭 AGENTE REGULATÓRIO
            </span>
            {pendingCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#3d6b4a' }}>{user?.name}</span>
            <button onClick={logout} style={{ background: 'none', border: '1px solid #1a3a22', color: '#3d6b4a', fontSize: '12px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              Sair
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Título e KPIs ── */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Mudanças Regulatórias Detectadas</h1>
          <p style={{ fontSize: '13px', color: '#5a9a68', margin: 0 }}>
            O agente monitora portais da Petrobras, MTE e Receita Federal toda semana. Revise e aplique as mudanças nos templates de certidão quando necessário.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Total detectado', value: changes.length, color: '#e2f0e8' },
            { label: 'Pendente de revisão', value: pendingCount, color: pendingCount > 0 ? '#f59e0b' : '#22c55e' },
            { label: 'Revisadas', value: changes.filter(c => c.reviewed).length, color: '#22c55e' },
          ].map(kpi => (
            <div key={kpi.label} style={card}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '10px', color: '#5a9a68', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['ALL', 'PENDING', 'REVIEWED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#0d3a1e' : 'transparent',
                border: `1px solid ${filter === f ? '#1a6b3a' : '#1a3a22'}`,
                color: filter === f ? '#4ade80' : '#5a9a68',
              }}
            >
              {f === 'ALL' ? 'Todas' : f === 'PENDING' ? 'Pendentes' : 'Revisadas'}
            </button>
          ))}
        </div>

        {/* ── Lista ── */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#3d6b4a' }}>Carregando...</div>
        ) : error ? (
          <div style={{ ...card, background: '#1a0606', borderColor: '#7f1d1d', color: '#f87171' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <div style={{ color: '#5a9a68', fontSize: '14px' }}>
              {filter === 'PENDING' ? 'Nenhuma mudança pendente de revisão.' : 'Nenhuma mudança registrada ainda.'}
            </div>
            <div style={{ fontSize: '12px', color: '#2a4a2e', marginTop: '6px' }}>O agente executa toda semana no domingo às 05h00 (Macapá).</div>
          </div>
        ) : (
          filtered.map(change => {
            const meta = TYPE_META[change.changeType];
            const isExpanding = actionId === change.id;
            return (
              <div key={change.id} style={{ ...card, opacity: change.reviewed ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badge tipo + revisado */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px',
                        background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}44`,
                      }}>
                        {meta.icon} {meta.label.toUpperCase()}
                      </span>
                      {change.reviewed && (
                        <span style={{ fontSize: '10px', color: '#22c55e', background: '#22c55e18', border: '1px solid #22c55e44', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          ✓ REVISADO
                        </span>
                      )}
                    </div>

                    {/* Portal */}
                    <div style={{ fontSize: '11px', color: '#5a9a68', marginBottom: '6px' }}>
                      🔗 {change.sourceName}
                    </div>

                    {/* Resumo */}
                    <div style={{ fontSize: '13px', color: '#c8e8d0', lineHeight: 1.5, marginBottom: '8px' }}>
                      {change.summary}
                    </div>

                    {/* Datas */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#3d6b4a' }}>
                        Detectado: {formatDate(change.detectedAt)}
                      </span>
                      {change.reviewedAt && (
                        <span style={{ fontSize: '11px', color: '#3d6b4a' }}>
                          Revisado: {formatDate(change.reviewedAt)}
                        </span>
                      )}
                    </div>

                    {/* Ação tomada */}
                    {change.actionTaken && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: '#0a1a0e', borderRadius: '6px', fontSize: '12px', color: '#9ab5a0', fontStyle: 'italic' }}>
                        Ação: {change.actionTaken}
                      </div>
                    )}

                    {/* Formulário de revisão inline */}
                    {isExpanding && !change.reviewed && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1a3a22' }}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#5a9a68', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>
                          AÇÃO TOMADA (opcional)
                        </label>
                        <input
                          style={inputStyle}
                          placeholder='ex: "Template NR-10 atualizado para validade 730 dias"'
                          value={actionNote}
                          onChange={e => setActionNote(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button
                            onClick={() => handleReview(change.id)}
                            disabled={reviewingId === change.id}
                            style={{
                              padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                              background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff',
                            }}
                          >
                            {reviewingId === change.id ? 'Salvando...' : '✓ Marcar como revisado'}
                          </button>
                          <button
                            onClick={() => { setActionId(null); setActionNote(''); }}
                            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: 'transparent', border: '1px solid #1a3a22', color: '#5a9a68' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão revisar */}
                  {!change.reviewed && !isExpanding && (
                    <button
                      onClick={() => { setActionId(change.id); setActionNote(''); }}
                      style={{
                        flexShrink: 0, padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        background: '#0d3a1e', border: '1px solid #1a6b3a', color: '#4ade80',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Revisar →
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
