/**
 * components/modules/CertificationFormModal.tsx
 *
 * Modal de 3 etapas para criar ou editar uma certidão.
 *
 * Etapa 1 — Identificação: nome, categoria, órgão emissor
 * Etapa 2 — Datas e observações: emissão, vencimento, notas
 * Etapa 3 — Documento: upload do arquivo PDF/imagem
 *
 * Por que 3 etapas e não um formulário único?
 * Um formulário com 8 campos exige que o usuário processe tudo de uma vez.
 * Três etapas progressivas reduzem a carga cognitiva: o usuário foca em
 * um tipo de informação por vez. Em mobile (onde boa parte dos clientes
 * vai acessar), isso também melhora muito a experiência de digitação.
 *
 * Suporte a dois modos:
 * - Criação: todos os campos vazios, etapa 1 primeiro
 * - Edição: campos pré-preenchidos, abre na etapa 1
 * - Criação a partir de template: nome, categoria e órgão pré-preenchidos
 */

import React, { useState, useRef, useCallback } from 'react';
import { CertificationCategory, CreateCertificationDto, Certification } from '@valinexus/shared';
import { CertificationTemplate, ExtractedDocData } from '../../services/certifications';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: CertificationCategory; label: string; color: string }[] = [
  { value: CertificationCategory.FISCAL,      label: 'Fiscal',       color: '#3b82f6' },
  { value: CertificationCategory.TRABALHISTA, label: 'Trabalhista',  color: '#8b5cf6' },
  { value: CertificationCategory.SEGURANCA,   label: 'Segurança',    color: '#f59e0b' },
  { value: CertificationCategory.TECNICO,     label: 'Técnico',      color: '#06b6d4' },
  { value: CertificationCategory.PETROBRAS,   label: 'Petrobras',    color: '#10b981' },
  { value: CertificationCategory.SEGURO,      label: 'Seguro',       color: '#f97316' },
  { value: CertificationCategory.OPERACIONAL, label: 'Operacional',  color: '#ec4899' },
  { value: CertificationCategory.AMBIENTAL,   label: 'Ambiental',    color: '#84cc16' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FormData {
  name: string;
  category: CertificationCategory | '';
  issuingBody: string;
  documentNumber: string;
  issuedAt: string;
  expiresAt: string;
  notes: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateCertificationDto, file?: File) => Promise<ExtractedDocData | null>;
  editingCert?: Certification | null;
  templates?: CertificationTemplate[];
  companyId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CertificationFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingCert,
  templates = [],
  companyId,
}: Props) {

  const isEditing = !!editingCert;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedDocData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    name: editingCert?.name ?? '',
    category: (editingCert?.category as CertificationCategory) ?? '',
    issuingBody: editingCert?.issuingBody ?? '',
    documentNumber: editingCert?.documentNumber ?? '',
    issuedAt: editingCert?.issuedAt
      ? (() => { const d = new Date(editingCert.issuedAt); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; })()
      : '',
    expiresAt: editingCert?.expiresAt
      ? (() => { const d = new Date(editingCert.expiresAt); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]; })()
      : '',
    notes: editingCert?.notes ?? '',
  });

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }));

  const applyTemplate = (tpl: CertificationTemplate) => {
    const validityDays = Number(tpl.typicalValidityDays);
    const expiresAt = new Date();
    if (!isNaN(validityDays)) expiresAt.setDate(expiresAt.getDate() + validityDays);

    setForm(f => ({
      ...f,
      name: tpl.name,
      category: tpl.category as CertificationCategory,
      issuingBody: tpl.issuingBody,
      expiresAt: isNaN(expiresAt.getTime()) ? '' : expiresAt.toISOString().split('T')[0],
    }));
    setShowTemplates(false);
  };

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setError('Formato inválido. Use PDF, JPG ou PNG.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 10MB.');
      return;
    }
    setError('');
    setSelectedFile(file);
  }, []);

  const step1Valid = form.name.trim().length >= 3 && form.category !== '' && form.issuingBody.trim().length >= 2;
  const step2Valid = form.expiresAt !== '';

  async function handleSubmit() {
    if (!step2Valid) return;
    setLoading(true);
    setError('');
    try {
      const dto: CreateCertificationDto = {
        companyId,
        name: form.name.trim(),
        category: form.category as CertificationCategory,
        issuingBody: form.issuingBody.trim(),
        documentNumber: form.documentNumber.trim() || undefined,
        issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : undefined,
        expiresAt: new Date(form.expiresAt).toISOString(),
        notes: form.notes.trim() || undefined,
      };
      const result = await onSubmit(dto, selectedFile ?? undefined);
      if (result) setExtracted(result);
      else onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao salvar. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Tela de resultado da extração IA — mostrada após salvar com arquivo
  if (extracted) {
    const confColor = extracted.confidence === 'high' ? '#22c55e' : '#f59e0b';
    const confLabel = extracted.confidence === 'high' ? 'Alta confiança' : 'Confiança média';
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '480px', maxWidth: '95vw', background: '#060d08',
          border: '1px solid #1a5c28', borderRadius: '16px', zIndex: 201,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#10b981)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>Claude extraiu dados do documento</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                Certidão salva · dados pré-preenchidos automaticamente
              </div>
            </div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: `${confColor}22`, color: confColor, border: `1px solid ${confColor}44`, marginBottom: '16px', letterSpacing: '0.5px' }}>
              {confLabel.toUpperCase()}
            </div>
            {[
              { label: 'Certidão detectada', value: extracted.certificationName },
              { label: 'Órgão emissor', value: extracted.issuingBody },
              { label: 'Número do documento', value: extracted.documentNumber },
              { label: 'Data de emissão', value: extracted.issuedAt },
              { label: 'Data de vencimento', value: extracted.expiresAt },
              { label: 'Categoria', value: extracted.category },
            ].map(row => row.value ? (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #0d2e14' }}>
                <span style={{ fontSize: '11px', color: '#5a9a68' }}>{row.label}</span>
                <span style={{ fontSize: '12px', color: '#e2f0e8', fontWeight: 600, maxWidth: '60%', textAlign: 'right' }}>{row.value}</span>
              </div>
            ) : null)}
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #0d2e14', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Fechar
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!isOpen) return null;

  // ── Estilos reutilizados ──────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: '#0a1a0e', border: '1px solid #1a5c28',
    color: '#e2f0e8', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', color: '#5a9a68',
    fontWeight: 600, marginBottom: '7px', letterSpacing: '0.5px',
  };

  const fieldWrap: React.CSSProperties = { marginBottom: '16px' };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 200, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '540px', maxWidth: '95vw', maxHeight: '90vh',
        background: '#060d08', border: '1px solid #1a5c28',
        borderRadius: '16px', zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #0d2e14',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2f0e8', margin: 0 }}>
              {isEditing ? '✏️ Editar Certidão' : '+ Nova Certidão'}
            </h2>
            <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '3px 0 0' }}>
              Etapa {step} de {isEditing ? 2 : 3}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#3d6b4a',
              fontSize: '20px', cursor: 'pointer', padding: '4px 8px',
              borderRadius: '6px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ height: '3px', background: '#0d2e14', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${(step / (isEditing ? 2 : 3)) * 100}%`,
            background: 'linear-gradient(90deg, #059669, #10b981)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

          {/* ── ETAPA 1: Identificação ── */}
          {step === 1 && (
            <div>
              {/* Usar template */}
              {!isEditing && templates.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <button
                    onClick={() => setShowTemplates(v => !v)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '8px',
                      background: showTemplates ? '#0d2e14' : 'transparent',
                      border: '1px dashed #1a5c28', color: '#4ade80',
                      fontSize: '13px', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    ⚡ {showTemplates ? 'Fechar templates' : 'Usar template de certidão Petrobras'}
                  </button>

                  {showTemplates && (
                    <div style={{
                      marginTop: '10px', background: '#070f0a',
                      border: '1px solid #0d2e14', borderRadius: '10px',
                      maxHeight: '200px', overflowY: 'auto',
                    }}>
                      {templates.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => applyTemplate(tpl)}
                          style={{
                            display: 'block', width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none',
                            borderBottom: '1px solid #0d2e14',
                            color: '#a7d9b2', fontSize: '13px', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = '#0a1a0e')}
                          onMouseOut={e => (e.currentTarget.style.background = 'none')}
                        >
                          <div style={{ fontWeight: 600 }}>{tpl.name}</div>
                          <div style={{ fontSize: '11px', color: '#3d6b4a', marginTop: '2px' }}>
                            {tpl.issuingBody} · válido por {tpl.typicalValidityDays} dias
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nome */}
              <div style={fieldWrap}>
                <label style={labelStyle}>NOME DA CERTIDÃO *</label>
                <input
                  style={inputStyle}
                  placeholder="ex: Certidão Negativa FGTS"
                  value={form.name}
                  onChange={set('name')}
                  onFocus={e => (e.target.style.borderColor = '#10b981')}
                  onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                />
              </div>

              {/* Categoria */}
              <div style={fieldWrap}>
                <label style={labelStyle}>CATEGORIA *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      style={{
                        padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${form.category === cat.value ? cat.color : '#0d2e14'}`,
                        background: form.category === cat.value ? `${cat.color}18` : '#070f0a',
                        color: form.category === cat.value ? cat.color : '#4a7a54',
                        fontSize: '12px', fontWeight: 600, textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Órgão emissor */}
              <div style={fieldWrap}>
                <label style={labelStyle}>ÓRGÃO EMISSOR *</label>
                <input
                  style={inputStyle}
                  placeholder="ex: Caixa Econômica Federal"
                  value={form.issuingBody}
                  onChange={set('issuingBody')}
                  onFocus={e => (e.target.style.borderColor = '#10b981')}
                  onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                />
              </div>

              {/* Número do documento */}
              <div style={fieldWrap}>
                <label style={labelStyle}>NÚMERO / PROTOCOLO <span style={{ color: '#2a4a30' }}>(opcional)</span></label>
                <input
                  style={inputStyle}
                  placeholder="ex: 00123.456789/2026-01"
                  value={form.documentNumber}
                  onChange={set('documentNumber')}
                  onFocus={e => (e.target.style.borderColor = '#10b981')}
                  onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                />
              </div>
            </div>
          )}

          {/* ── ETAPA 2: Datas e observações ── */}
          {step === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>DATA DE EMISSÃO <span style={{ color: '#2a4a30' }}>(opcional)</span></label>
                  <input
                    type="date"
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                    value={form.issuedAt}
                    onChange={set('issuedAt')}
                    onFocus={e => (e.target.style.borderColor = '#10b981')}
                    onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                  />
                </div>
                <div>
                  <label style={labelStyle}>DATA DE VENCIMENTO *</label>
                  <input
                    type="date"
                    style={{
                      ...inputStyle, colorScheme: 'dark',
                      borderColor: !form.expiresAt ? '#7f1d1d' : '#1a5c28',
                    }}
                    value={form.expiresAt}
                    onChange={set('expiresAt')}
                    min={new Date().toISOString().split('T')[0]}
                    onFocus={e => (e.target.style.borderColor = '#10b981')}
                    onBlur={e => (e.target.style.borderColor = form.expiresAt ? '#1a5c28' : '#7f1d1d')}
                  />
                </div>
              </div>

              {/* Preview de dias até vencer */}
              {form.expiresAt && (
                <div style={{
                  marginBottom: '16px', padding: '12px 14px', borderRadius: '8px',
                  background: (() => {
                    const days = Math.ceil((new Date(form.expiresAt).getTime() - Date.now()) / 86400000);
                    return days <= 0 ? '#1a0606' : days <= 30 ? '#1a0e00' : '#0a1a0e';
                  })(),
                  border: `1px solid ${(() => {
                    const days = Math.ceil((new Date(form.expiresAt).getTime() - Date.now()) / 86400000);
                    return days <= 0 ? '#7f1d1d' : days <= 30 ? '#92400e' : '#1a5c28';
                  })()}`,
                  fontSize: '13px',
                  color: (() => {
                    const days = Math.ceil((new Date(form.expiresAt).getTime() - Date.now()) / 86400000);
                    return days <= 0 ? '#f87171' : days <= 30 ? '#fbbf24' : '#4ade80';
                  })(),
                }}>
                  {(() => {
                    const days = Math.ceil((new Date(form.expiresAt).getTime() - Date.now()) / 86400000);
                    if (days <= 0) return `⚠️ Data no passado — certidão será marcada como vencida`;
                    if (days <= 30) return `⏳ Vence em ${days} dias — alerta será enviado imediatamente`;
                    return `✅ Vence em ${days} dias — alerta nos dias 30, 15 e 7 antes do vencimento`;
                  })()}
                </div>
              )}

              {/* Observações */}
              <div style={fieldWrap}>
                <label style={labelStyle}>OBSERVAÇÕES <span style={{ color: '#2a4a30' }}>(opcional)</span></label>
                <textarea
                  style={{
                    ...inputStyle, resize: 'vertical', minHeight: '100px',
                    fontFamily: 'inherit', lineHeight: '1.6',
                  }}
                  placeholder="Links de renovação, contatos do órgão emissor, instruções internas..."
                  value={form.notes}
                  onChange={set('notes')}
                  maxLength={500}
                  onFocus={e => (e.target.style.borderColor = '#10b981')}
                  onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                />
                <div style={{ fontSize: '11px', color: '#2a4a30', textAlign: 'right', marginTop: '4px' }}>
                  {form.notes.length}/500
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Upload de arquivo (só na criação) ── */}
          {step === 3 && !isEditing && (
            <div>
              <p style={{ fontSize: '13px', color: '#4a7a54', marginBottom: '16px', lineHeight: 1.6 }}>
                Anexe o documento da certidão em PDF, JPG ou PNG.
                Você pode pular este passo e fazer o upload depois — a certidão ficará com status <strong style={{ color: '#a78bfa' }}>Pendente</strong>.
              </p>

              {/* Área de drop */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#10b981' : selectedFile ? '#1a6b3a' : '#1a5c28'}`,
                  borderRadius: '12px',
                  background: dragOver ? 'rgba(16,185,129,0.06)' : selectedFile ? 'rgba(16,185,129,0.04)' : '#070f0a',
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '16px',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />

                {selectedFile ? (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📎</div>
                    <div style={{ fontWeight: 600, color: '#4ade80', fontSize: '14px' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#3d6b4a', marginTop: '4px' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      style={{
                        marginTop: '10px', padding: '4px 12px', borderRadius: '6px',
                        background: 'transparent', border: '1px solid #7f1d1d',
                        color: '#f87171', fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      Remover arquivo
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📄</div>
                    <div style={{ fontWeight: 600, color: '#5a9a68', fontSize: '14px' }}>
                      Clique ou arraste o arquivo aqui
                    </div>
                    <div style={{ fontSize: '12px', color: '#3d6b4a', marginTop: '6px' }}>
                      PDF, JPG, PNG · máximo 10MB
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Erro global */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginTop: '4px',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
              fontSize: '13px', color: '#f87171',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer com navegação ── */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #0d2e14',
          display: 'flex', justifyContent: 'space-between', gap: '10px',
          flexShrink: 0, background: '#060d08',
        }}>
          {/* Botão voltar / cancelar */}
          <button
            onClick={() => step === 1 ? onClose() : setStep(s => s - 1)}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontSize: '13px',
              background: 'transparent', border: '1px solid #1a5c28',
              color: '#4a7a54', cursor: 'pointer',
            }}
          >
            {step === 1 ? 'Cancelar' : '← Voltar'}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Pular upload (só etapa 3) */}
            {step === 3 && !isEditing && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: '10px 20px', borderRadius: '8px', fontSize: '13px',
                  background: 'transparent', border: '1px solid #1a5c28',
                  color: '#4a7a54', cursor: 'pointer',
                }}
              >
                Pular upload
              </button>
            )}

            {/* Avançar / Salvar */}
            <button
              onClick={() => {
                if (step === 1 && !step1Valid) return;
                if (step === 2 && !step2Valid) { setError('Informe a data de vencimento.'); return; }
                if (step < (isEditing ? 2 : 3)) { setError(''); setStep(s => s + 1); }
                else handleSubmit();
              }}
              disabled={
                loading ||
                (step === 1 && !step1Valid) ||
                (step === 2 && !step2Valid)
              }
              style={{
                padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                background: loading || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
                  ? '#0a2014'
                  : 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none',
                color: loading || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
                  ? '#1a5c28'
                  : '#fff',
                cursor: loading ? 'wait' : 'pointer',
                minWidth: '120px',
              }}
            >
              {loading
                ? 'Salvando...'
                : step < (isEditing ? 2 : 3)
                  ? 'Próximo →'
                  : isEditing ? 'Salvar alterações' : 'Criar certidão'}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
