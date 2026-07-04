import React, { useState, useRef, useCallback } from 'react';
import { CertificationCategory, CreateCertificationDto, Certification } from '@valinexus/shared';
import { CertificationTemplate, ExtractedDocData, certificationsApi } from '../../services/certifications';

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

const CATEGORY_MAP: Record<string, CertificationCategory> = {
  fiscal: CertificationCategory.FISCAL,
  trabalhista: CertificationCategory.TRABALHISTA,
  seguranca: CertificationCategory.SEGURANCA,
  'segurança': CertificationCategory.SEGURANCA,
  tecnico: CertificationCategory.TECNICO,
  'técnico': CertificationCategory.TECNICO,
  petrobras: CertificationCategory.PETROBRAS,
  seguro: CertificationCategory.SEGURO,
  operacional: CertificationCategory.OPERACIONAL,
  ambiental: CertificationCategory.AMBIENTAL,
};

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

function safeDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function mapCategory(raw: string | null): CertificationCategory | '' {
  if (!raw) return '';
  const key = raw.toLowerCase().trim();
  return CATEGORY_MAP[key] ?? '';
}

export function CertificationFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingCert,
  templates = [],
  companyId,
}: Props) {

  const isEditing = !!editingCert;

  // step 0 = upload (new certs only), 1 = identification, 2 = dates + save
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    name: String(editingCert?.name ?? ''),
    category: (editingCert?.category as CertificationCategory) ?? '',
    issuingBody: String(editingCert?.issuingBody ?? ''),
    documentNumber: String(editingCert?.documentNumber ?? ''),
    issuedAt: safeDate(editingCert?.issuedAt),
    expiresAt: safeDate(editingCert?.expiresAt),
    notes: String(editingCert?.notes ?? ''),
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

  async function handleExtract() {
    if (!selectedFile) return;
    setExtracting(true);
    setError('');
    try {
      const data = await certificationsApi.extractFromFile(selectedFile);
      setExtractionDone(true);
      setForm({
        name: String(data.certificationName ?? ''),
        category: mapCategory(data.category),
        issuingBody: String(data.issuingBody ?? ''),
        documentNumber: String(data.documentNumber ?? ''),
        issuedAt: safeDate(data.issuedAt),
        expiresAt: safeDate(data.expiresAt),
        notes: '',
      });
      setStep(1);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao extrair dados. Preencha manualmente.';
      setError(msg);
      setStep(1);
    } finally {
      setExtracting(false);
    }
  }

  const step1Valid = (form.name || '').trim().length >= 3 && form.category !== '' && (form.issuingBody || '').trim().length >= 2;
  const step2Valid = form.expiresAt !== '';

  async function handleSubmit() {
    if (!step2Valid) return;
    setLoading(true);
    setError('');
    try {
      const dto: CreateCertificationDto = {
        companyId,
        name: (form.name || '').trim(),
        category: form.category as CertificationCategory,
        issuingBody: (form.issuingBody || '').trim(),
        documentNumber: (form.documentNumber || '').trim() || undefined,
        issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : new Date().toISOString(),
        notes: (form.notes || '').trim() || undefined,
      };
      await onSubmit(dto, selectedFile ?? undefined);
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao salvar. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

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

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 200, backdropFilter: 'blur(4px)',
        }}
      />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '540px', maxWidth: '95vw', maxHeight: '90vh',
        background: '#060d08', border: '1px solid #1a5c28',
        borderRadius: '16px', zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #0d2e14',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2f0e8', margin: 0 }}>
              {isEditing ? '✏️ Editar Certidão' : step === 0 ? '📄 Upload do Documento' : '+ Nova Certidão'}
            </h2>
            <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '3px 0 0' }}>
              {step === 0
                ? 'Envie o PDF e a IA preenche automaticamente'
                : `Etapa ${step} de 2`}
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

        {/* Progress bar */}
        <div style={{ height: '3px', background: '#0d2e14', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: step === 0 ? '5%' : `${(step / 2) * 100}%`,
            background: 'linear-gradient(90deg, #059669, #10b981)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

          {/* STEP 0: Upload first */}
          {step === 0 && !isEditing && (
            <div>
              {extracting ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{
                    width: '60px', height: '60px', margin: '0 auto 20px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'vn-pulse 1.5s ease-in-out infinite',
                  }}>
                    <span style={{ fontSize: '28px' }}>🤖</span>
                  </div>
                  <style>{`@keyframes vn-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }`}</style>
                  <div style={{ fontWeight: 700, color: '#e2f0e8', fontSize: '15px', marginBottom: '8px' }}>
                    Claude está lendo o documento...
                  </div>
                  <div style={{ fontSize: '13px', color: '#4a7a54', lineHeight: 1.6 }}>
                    Extraindo nome, órgão emissor, datas e categoria.
                    <br />Isso leva de 3 a 8 segundos.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
                    background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>🤖</span>
                    <div style={{ fontSize: '13px', color: '#c4b5fd', lineHeight: 1.6 }}>
                      <strong>IA preenche automaticamente!</strong> Envie o PDF ou imagem da certidão
                      e o Claude vai extrair todos os dados. Você só confere e salva.
                    </div>
                  </div>

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
                      border: `2px dashed ${dragOver ? '#a78bfa' : selectedFile ? '#7c3aed' : '#1a5c28'}`,
                      borderRadius: '12px',
                      background: dragOver ? 'rgba(124,58,237,0.08)' : selectedFile ? 'rgba(124,58,237,0.04)' : '#070f0a',
                      padding: '40px 24px',
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
                        <div style={{ fontWeight: 600, color: '#a78bfa', fontSize: '14px' }}>
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
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
                        <div style={{ fontWeight: 600, color: '#5a9a68', fontSize: '14px' }}>
                          Clique ou arraste o documento aqui
                        </div>
                        <div style={{ fontSize: '12px', color: '#3d6b4a', marginTop: '6px' }}>
                          PDF, JPG, PNG · máximo 10MB
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 1: Identification */}
          {step === 1 && (
            <div>
              {extractionDone && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '18px',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '16px' }}>✅</span>
                  <span style={{ fontSize: '12px', color: '#4ade80' }}>
                    Dados extraídos automaticamente. Confira e ajuste se necessário.
                  </span>
                </div>
              )}

              {!isEditing && !extractionDone && templates.length > 0 && (
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

          {/* STEP 2: Dates + save */}
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

              {selectedFile && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '14px' }}>📎</span>
                  <span style={{ fontSize: '12px', color: '#c4b5fd' }}>
                    {selectedFile.name} será enviado junto com a certidão
                  </span>
                </div>
              )}

              <div style={fieldWrap}>
                <label style={labelStyle}>OBSERVAÇÕES <span style={{ color: '#2a4a30' }}>(opcional)</span></label>
                <textarea
                  style={{
                    ...inputStyle, resize: 'vertical', minHeight: '80px',
                    fontFamily: 'inherit', lineHeight: '1.6',
                  }}
                  placeholder="Links de renovação, contatos do órgão emissor..."
                  value={form.notes}
                  onChange={set('notes')}
                  maxLength={500}
                  onFocus={e => (e.target.style.borderColor = '#10b981')}
                  onBlur={e => (e.target.style.borderColor = '#1a5c28')}
                />
                <div style={{ fontSize: '11px', color: '#2a4a30', textAlign: 'right', marginTop: '4px' }}>
                  {(form.notes || '').length}/500
                </div>
              </div>
            </div>
          )}

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

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #0d2e14',
          display: 'flex', justifyContent: 'space-between', gap: '10px',
          flexShrink: 0, background: '#060d08',
        }}>
          <button
            onClick={() => {
              if (step === 0 || (step === 1 && isEditing)) onClose();
              else if (step === 1 && !isEditing) setStep(0);
              else setStep(s => s - 1);
            }}
            disabled={extracting}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontSize: '13px',
              background: 'transparent', border: '1px solid #1a5c28',
              color: '#4a7a54', cursor: extracting ? 'not-allowed' : 'pointer',
              opacity: extracting ? 0.5 : 1,
            }}
          >
            {(step === 0 || (step === 1 && isEditing)) ? 'Cancelar' : '← Voltar'}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {step === 0 && !extracting && (
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '10px 20px', borderRadius: '8px', fontSize: '13px',
                  background: 'transparent', border: '1px solid #1a5c28',
                  color: '#4a7a54', cursor: 'pointer',
                }}
              >
                Preencher manual
              </button>
            )}

            <button
              onClick={() => {
                if (step === 0) {
                  handleExtract();
                } else if (step === 1 && !step1Valid) {
                  return;
                } else if (step === 2 && !step2Valid) {
                  setError('Informe a data de vencimento.');
                  return;
                } else if (step < 2) {
                  setError('');
                  setStep(s => s + 1);
                } else {
                  handleSubmit();
                }
              }}
              disabled={
                extracting ||
                loading ||
                (step === 0 && !selectedFile) ||
                (step === 1 && !step1Valid) ||
                (step === 2 && !step2Valid)
              }
              style={{
                padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                background:
                  extracting || loading || (step === 0 && !selectedFile) || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
                    ? '#0a2014'
                    : step === 0
                      ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                      : 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none',
                color:
                  extracting || loading || (step === 0 && !selectedFile) || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)
                    ? '#1a5c28'
                    : '#fff',
                cursor: (extracting || loading) ? 'wait' : 'pointer',
                minWidth: '140px',
              }}
            >
              {extracting
                ? 'Extraindo...'
                : loading
                  ? 'Salvando...'
                  : step === 0
                    ? '🤖 Extrair com IA'
                    : step < 2
                      ? 'Próximo →'
                      : isEditing ? 'Salvar alterações' : 'Criar certidão'}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
