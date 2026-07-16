/**
 * CompanyEditModal — Edição dos dados cadastrais de uma empresa.
 *
 * Usado pelo SUPER_ADMIN na aba "Dados" do CompanyDetailPage.
 * O CNPJ não é editável (chave de identidade da empresa); para
 * corrigir CNPJ errado, o caminho é recadastrar a empresa.
 */
import React, { useState } from 'react';
import { Company, CompanyStatus, PlanTier, UpdateCompanyDto } from '@valinexus/shared';
import { companiesApi } from '../../services/companies';

interface Props {
  company: Company;
  onClose: () => void;
  onSaved: (updated: Company) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  background: '#0a1a0e', border: '1px solid #1a3a22', color: '#e2f0e8',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '10px', color: '#3d6b4a', fontFamily: 'monospace',
  letterSpacing: '0.5px', marginBottom: '4px', display: 'block',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function CompanyEditModal({ company, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    razaoSocial: company.razaoSocial,
    nomeFantasia: company.nomeFantasia ?? '',
    email: company.email,
    phone: company.phone,
    whatsapp: company.whatsapp,
    crcPetrobrasCode: company.crcPetrobrasCode ?? '',
    status: company.status,
    planTier: company.planTier,
    street: company.address.street,
    number: company.address.number,
    complement: company.address.complement ?? '',
    neighborhood: company.address.neighborhood,
    city: company.address.city,
    state: company.address.state,
    zipCode: company.address.zipCode,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (form.razaoSocial.trim().length < 3) { setError('Razão social é obrigatória.'); return; }
    if (!form.email.includes('@')) { setError('E-mail inválido.'); return; }
    setSaving(true);
    setError('');
    try {
      const dto: UpdateCompanyDto = {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        crcPetrobrasCode: form.crcPetrobrasCode.trim() || undefined,
        status: form.status,
        planTier: form.planTier,
        address: {
          street: form.street.trim(),
          number: form.number.trim(),
          complement: form.complement.trim() || null,
          neighborhood: form.neighborhood.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zipCode: form.zipCode.trim(),
        },
      };
      const updated = await companiesApi.update(company.id, dto);
      onSaved(updated);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? 'Erro ao salvar alterações.');
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
    }}>
      <div style={{
        width: '640px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto',
        background: '#060d08', border: '1px solid #1a5c28', borderRadius: '14px',
        padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e2f0e8' }}>Editar Empresa</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#3d6b4a', fontFamily: 'monospace' }}>
              CNPJ {company.cnpj} (não editável)
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#3d6b4a', fontSize: '18px', cursor: 'pointer',
          }}>✕</button>
        </div>

        {error && (
          <div style={{
            marginBottom: '14px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
            fontSize: '13px', color: '#f87171',
          }}>{error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="RAZÃO SOCIAL *">
              <input style={inputStyle} value={form.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} />
            </Field>
          </div>
          <Field label="NOME FANTASIA">
            <input style={inputStyle} value={form.nomeFantasia} onChange={e => set('nomeFantasia', e.target.value)} />
          </Field>
          <Field label="CRC PETROBRAS">
            <input style={inputStyle} value={form.crcPetrobrasCode} onChange={e => set('crcPetrobrasCode', e.target.value)} />
          </Field>
          <Field label="E-MAIL *">
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="TELEFONE *">
            <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
          <Field label="WHATSAPP *">
            <input style={inputStyle} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
          </Field>
          <Field label="STATUS">
            <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value as CompanyStatus)}>
              <option value={CompanyStatus.ACTIVE}>Ativa</option>
              <option value={CompanyStatus.SUSPENDED}>Suspensa</option>
              <option value={CompanyStatus.PENDING_DOCS}>Pendente de Documentos</option>
              <option value={CompanyStatus.INACTIVE}>Inativa</option>
            </select>
          </Field>
          <Field label="PLANO">
            <select style={inputStyle} value={form.planTier} onChange={e => set('planTier', e.target.value as PlanTier)}>
              <option value={PlanTier.STARTER}>Starter — R$ 490/mês</option>
              <option value={PlanTier.PROFESSIONAL}>Professional — R$ 1.490/mês</option>
              <option value={PlanTier.ENTERPRISE}>Enterprise — R$ 3.900/mês</option>
            </select>
          </Field>
        </div>

        <div style={{
          margin: '18px 0 12px', fontSize: '11px', color: '#3d6b4a',
          fontFamily: 'monospace', letterSpacing: '1px',
        }}>ENDEREÇO</div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
          <Field label="LOGRADOURO">
            <input style={inputStyle} value={form.street} onChange={e => set('street', e.target.value)} />
          </Field>
          <Field label="NÚMERO">
            <input style={inputStyle} value={form.number} onChange={e => set('number', e.target.value)} />
          </Field>
          <Field label="COMPLEMENTO">
            <input style={inputStyle} value={form.complement} onChange={e => set('complement', e.target.value)} />
          </Field>
          <Field label="BAIRRO">
            <input style={inputStyle} value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
          </Field>
          <Field label="CIDADE">
            <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label="UF">
            <input style={inputStyle} maxLength={2} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
          </Field>
          <Field label="CEP">
            <input style={inputStyle} value={form.zipCode} onChange={e => set('zipCode', e.target.value)} />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: '9px 18px', borderRadius: '8px', fontSize: '13px',
            background: 'transparent', border: '1px solid #1a3a22', color: '#5a9a68', cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff',
            cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            boxShadow: '0 0 14px rgba(16,185,129,0.2)',
          }}>{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
        </div>
      </div>
    </div>
  );
}
