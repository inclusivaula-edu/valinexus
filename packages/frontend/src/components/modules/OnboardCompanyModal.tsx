/**
 * components/modules/OnboardCompanyModal.tsx
 *
 * Substitui o fluxo manual "rodar seed.ts com variáveis de ambiente no
 * terminal" por um formulário no painel. É o que viabiliza o onboarding
 * assistido sem depender de acesso ao Railway/terminal para cada cliente novo.
 *
 * Fluxo: 2 etapas.
 * Etapa 1 — Dados da empresa (CNPJ, razão social, contato, endereço)
 * Etapa 2 — Responsável + confirmação. Ao submeter, a senha temporária
 *           gerada pelo backend é exibida em uma tela de sucesso com
 *           botão de copiar — o operador copia e envia por WhatsApp
 *           manualmente (fora do sistema, por design: a senha nunca
 *           deve ficar registrada em lugar nenhum além desta tela única).
 */

import React, { useState } from 'react';
import { CreateCompanyWithAdminDto, CreateCompanyWithAdminResult, formatCnpj } from '@valinexus/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateCompanyWithAdminDto) => Promise<CreateCompanyWithAdminResult>;
}

interface FormData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  phone: string;
  whatsapp: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  serviceCategories: string[];
  adminName: string;
  adminEmail: string;
  applyDefaultTemplates: boolean;
}

const SERVICE_CATEGORY_OPTIONS = [
  { value: 'transporte', label: 'Transporte' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'construcao', label: 'Construção' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'vigilancia', label: 'Vigilância' },
  { value: 'catering', label: 'Catering' },
  { value: 'engenharia', label: 'Engenharia' },
];

const EMPTY_FORM: FormData = {
  cnpj: '', razaoSocial: '', nomeFantasia: '', email: '', phone: '', whatsapp: '',
  street: '', number: '', complement: '', neighborhood: '', city: 'Macapá', state: 'AP', zipCode: '',
  serviceCategories: [], adminName: '', adminEmail: '', applyDefaultTemplates: true,
};

export function OnboardCompanyModal({ isOpen, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateCompanyWithAdminResult | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      serviceCategories: f.serviceCategories.includes(cat)
        ? f.serviceCategories.filter(c => c !== cat)
        : [...f.serviceCategories, cat],
    }));
  };

  const step1Valid =
    form.cnpj.replace(/\D/g, '').length === 14 &&
    form.razaoSocial.trim().length >= 3 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 8 &&
    form.whatsapp.trim().length >= 8 &&
    form.street.trim().length >= 2 &&
    form.number.trim().length >= 1 &&
    form.neighborhood.trim().length >= 2 &&
    form.zipCode.trim().length >= 8;

  const step2Valid = form.adminName.trim().length >= 3 && form.adminEmail.includes('@');

  function handleClose() {
    setStep(1);
    setForm(EMPTY_FORM);
    setError('');
    setResult(null);
    setCopied(false);
    onClose();
  }

  async function handleSubmit() {
    if (!step2Valid) return;
    setLoading(true);
    setError('');
    try {
      const dto: CreateCompanyWithAdminDto = {
        cnpj: form.cnpj,
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        address: {
          street: form.street.trim(),
          number: form.number.trim(),
          complement: form.complement.trim() || null,
          neighborhood: form.neighborhood.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          zipCode: form.zipCode.trim(),
        },
        serviceCategories: form.serviceCategories,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        applyDefaultTemplates: form.applyDefaultTemplates,
      };
      const res = await onSubmit(dto);
      setResult(res);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao cadastrar empresa. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function copyCredentials() {
    if (!result) return;
    const text = `🔐 Acesso VALINEXUS\n\nEmpresa: ${form.razaoSocial}\nLogin: ${result.adminEmail}\nSenha temporária: ${result.temporaryPassword}\n\nAcesse: ${window.location.origin}/login\n\n⚠️ Você precisará trocar essa senha no primeiro acesso.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (!isOpen) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: '#0a1a0e', border: '1px solid #1a5c28',
    color: '#e2f0e8', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', color: '#5a9a68', fontWeight: 600,
    marginBottom: '7px', letterSpacing: '0.5px',
  };
  const fieldWrap: React.CSSProperties = { marginBottom: '14px' };

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '580px', maxWidth: '95vw', maxHeight: '90vh',
        background: '#060d08', border: '1px solid #1a5c28', borderRadius: '16px',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>

        {result ? (
          <>
            <div style={{ padding: '24px', borderBottom: '1px solid #0d2e14' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#4ade80', margin: 0 }}>
                ✅ Empresa cadastrada com sucesso!
              </h2>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <p style={{ fontSize: '13px', color: '#4a7a54', marginBottom: '20px', lineHeight: 1.6 }}>
                <strong style={{ color: '#fbbf24' }}>{form.razaoSocial}</strong> já está ativa na plataforma.
                Copie as credenciais abaixo e envie ao responsável por um canal seguro (WhatsApp, ligação).
                Esta senha <strong>não será exibida novamente</strong>.
              </p>

              <div style={{
                background: '#0a1a0e', border: '1px solid #1a5c28', borderRadius: '10px',
                padding: '18px', marginBottom: '16px', fontFamily: 'monospace', fontSize: '13px',
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#3d6b4a' }}>Login: </span>
                  <span style={{ color: '#e2f0e8' }}>{result.adminEmail}</span>
                </div>
                <div>
                  <span style={{ color: '#3d6b4a' }}>Senha temporária: </span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{result.temporaryPassword}</span>
                </div>
              </div>

              <button
                onClick={copyCredentials}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  background: copied ? '#0d2e14' : 'linear-gradient(135deg, #059669, #10b981)',
                  border: copied ? '1px solid #1a6b3a' : 'none',
                  color: copied ? '#4ade80' : '#fff', cursor: 'pointer', marginBottom: '10px',
                }}
              >{copied ? '✅ Copiado para a área de transferência!' : '📋 Copiar mensagem para WhatsApp'}</button>

              <button
                onClick={handleClose}
                style={{
                  width: '100%', padding: '11px', borderRadius: '8px', fontSize: '13px',
                  background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a54', cursor: 'pointer',
                }}
              >Fechar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #0d2e14', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#e2f0e8', margin: 0 }}>+ Cadastrar Empresa Cliente</h2>
                <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '3px 0 0' }}>Etapa {step} de 2</p>
              </div>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#3d6b4a', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }}>×</button>
            </div>

            <div style={{ height: '3px', background: '#0d2e14', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${(step / 2) * 100}%`, background: 'linear-gradient(90deg, #059669, #10b981)', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

              {step === 1 && (
                <div>
                  <div style={fieldWrap}>
                    <label style={labelStyle}>CNPJ *</label>
                    <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.cnpj}
                      onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                      onBlur={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length === 14) setForm(f => ({ ...f, cnpj: formatCnpj(v) })); }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>RAZÃO SOCIAL *</label>
                      <input style={inputStyle} placeholder="Transportadora Norte Ltda" value={form.razaoSocial} onChange={set('razaoSocial')} />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>NOME FANTASIA</label>
                      <input style={inputStyle} placeholder="TransNorte" value={form.nomeFantasia} onChange={set('nomeFantasia')} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>E-MAIL DA EMPRESA *</label>
                      <input style={inputStyle} placeholder="contato@empresa.com.br" value={form.email} onChange={set('email')} />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>TELEFONE *</label>
                      <input style={inputStyle} placeholder="(96) 3212-0000" value={form.phone} onChange={set('phone')} />
                    </div>
                  </div>

                  <div style={fieldWrap}>
                    <label style={labelStyle}>WHATSAPP (recebe alertas) *</label>
                    <input style={inputStyle} placeholder="(96) 99900-0000" value={form.whatsapp} onChange={set('whatsapp')} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>ENDEREÇO *</label>
                      <input style={inputStyle} placeholder="Av. FAB" value={form.street} onChange={set('street')} />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>NÚMERO *</label>
                      <input style={inputStyle} placeholder="100" value={form.number} onChange={set('number')} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>BAIRRO *</label>
                      <input style={inputStyle} placeholder="Centro" value={form.neighborhood} onChange={set('neighborhood')} />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>CIDADE *</label>
                      <input style={inputStyle} value={form.city} onChange={set('city')} />
                    </div>
                    <div style={fieldWrap}>
                      <label style={labelStyle}>CEP *</label>
                      <input style={inputStyle} placeholder="68900-000" value={form.zipCode} onChange={set('zipCode')} />
                    </div>
                  </div>

                  <div style={fieldWrap}>
                    <label style={labelStyle}>CATEGORIAS DE SERVIÇO</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {SERVICE_CATEGORY_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => toggleCategory(opt.value)}
                          style={{
                            padding: '6px 12px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
                            background: form.serviceCategories.includes(opt.value) ? '#0d2e14' : 'transparent',
                            border: `1px solid ${form.serviceCategories.includes(opt.value) ? '#1a6b3a' : '#1a3a22'}`,
                            color: form.serviceCategories.includes(opt.value) ? '#4ade80' : '#3d6b4a',
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p style={{ fontSize: '13px', color: '#4a7a54', marginBottom: '20px', lineHeight: 1.6 }}>
                    Dados de quem vai acessar o painel como administrador da empresa. Uma senha
                    temporária será gerada automaticamente — o responsável será obrigado a trocá-la no primeiro acesso.
                  </p>

                  <div style={fieldWrap}>
                    <label style={labelStyle}>NOME DO RESPONSÁVEL *</label>
                    <input style={inputStyle} placeholder="João da Silva" value={form.adminName} onChange={set('adminName')} />
                  </div>
                  <div style={fieldWrap}>
                    <label style={labelStyle}>E-MAIL DE LOGIN *</label>
                    <input style={inputStyle} placeholder="joao@empresa.com.br" value={form.adminEmail} onChange={set('adminEmail')} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.applyDefaultTemplates}
                      onChange={e => setForm(f => ({ ...f, applyDefaultTemplates: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                    />
                    <span style={{ fontSize: '13px', color: '#a7d9b2' }}>
                      Aplicar as 18 certidões padrão da cadeia Petrobras automaticamente
                    </span>
                  </label>

                  <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: '#070f0a', border: '1px solid #0d2e14', fontSize: '12px', color: '#4a7a54' }}>
                    <div><strong style={{ color: '#a7d9b2' }}>{form.razaoSocial}</strong> — {formatCnpj(form.cnpj.replace(/\D/g, '').padEnd(14, '0'))}</div>
                    <div style={{ marginTop: '4px' }}>{form.city}/{form.state} · {form.serviceCategories.length} categoria(s) de serviço</div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', marginTop: '14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', fontSize: '13px', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #0d2e14', display: 'flex', justifyContent: 'space-between', gap: '10px', flexShrink: 0 }}>
              <button onClick={() => step === 1 ? handleClose() : setStep(1)}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', background: 'transparent', border: '1px solid #1a5c28', color: '#4a7a54', cursor: 'pointer' }}
              >{step === 1 ? 'Cancelar' : '← Voltar'}</button>

              <button
                onClick={() => {
                  if (step === 1 && !step1Valid) { setError('Preencha todos os campos obrigatórios.'); return; }
                  if (step === 1) { setError(''); setStep(2); return; }
                  handleSubmit();
                }}
                disabled={loading || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                style={{
                  padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, minWidth: '140px',
                  background: loading || (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? '#0a2014' : 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none',
                  color: loading || (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ? '#1a5c28' : '#fff',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >{loading ? 'Cadastrando...' : step === 1 ? 'Próximo →' : 'Cadastrar empresa'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
