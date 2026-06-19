/**
 * components/modules/NotificationSettingsPanel.tsx
 *
 * Painel de configuração de alertas de notificação.
 * O cliente configura aqui:
 * - Número WhatsApp que recebe os alertas
 * - Email de destino
 * - Quais dias antes do vencimento receber alertas
 * - Botão "Enviar teste agora" para validar que chegou
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface Settings {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappNumber: string | null;
  emailAddress: string | null;
  alertDays: number[];
  dailyAlertDays: number;
}

const DEFAULT_ALERT_DAYS = [30, 15, 7];
const AVAILABLE_DAYS = [60, 45, 30, 20, 15, 10, 7, 5, 3];

export function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    whatsappEnabled: true,
    emailEnabled: true,
    whatsappNumber: '',
    emailAddress: '',
    alertDays: DEFAULT_ALERT_DAYS,
    dailyAlertDays: 3,
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState<'WHATSAPP' | 'EMAIL' | null>(null);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [testResult, setTestResult] = useState<{ channel: string; success: boolean } | null>(null);

  useEffect(() => {
    api.get('/notifications/settings').then(({ data }) => {
      if (data.data) setSettings(data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggleDay(day: number) {
    setSettings(s => ({
      ...s,
      alertDays: s.alertDays.includes(day)
        ? s.alertDays.filter(d => d !== day)
        : [...s.alertDays, day].sort((a, b) => b - a),
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put('/notifications/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(channel: 'WHATSAPP' | 'EMAIL') {
    setTesting(channel);
    setTestResult(null);
    try {
      const { data } = await api.post('/notifications/test', { channel });
      setTestResult({ channel, success: data.success });
    } catch {
      setTestResult({ channel, success: false });
    } finally {
      setTesting(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: '#0a1a0e', border: '1px solid #1a5c28',
    color: '#e2f0e8', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box',
  };

  if (loading) return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#3d6b4a', fontSize: '13px' }}>
      Carregando configurações...
    </div>
  );

  return (
    <div style={{ maxWidth: '600px' }}>

      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#e2f0e8', marginBottom: '6px' }}>
        🔔 Alertas de Vencimento
      </h2>
      <p style={{ fontSize: '13px', color: '#4a7a54', marginBottom: '28px', lineHeight: 1.6 }}>
        Configure quando e como receber alertas sobre certidões próximas do vencimento.
      </p>

      {/* ── WhatsApp ── */}
      <div style={{
        background: '#070f0a', border: '1px solid #0d2e14',
        borderRadius: '12px', padding: '20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📱</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2f0e8' }}>WhatsApp</div>
              <div style={{ fontSize: '11px', color: '#3d6b4a' }}>Alertas via mensagem</div>
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={() => setSettings(s => ({ ...s, whatsappEnabled: !s.whatsappEnabled }))}
            style={{
              width: '44px', height: '24px', borderRadius: '100px',
              background: settings.whatsappEnabled ? '#10b981' : '#1a3a22',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: settings.whatsappEnabled ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {settings.whatsappEnabled && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#5a9a68', fontWeight: 600, marginBottom: '7px', letterSpacing: '0.5px' }}>
              NÚMERO WHATSAPP (com DDD)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="(96) 99911-3575"
                value={settings.whatsappNumber ?? ''}
                onChange={e => setSettings(s => ({ ...s, whatsappNumber: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#10b981')}
                onBlur={e => (e.target.style.borderColor = '#1a5c28')}
              />
              <button
                onClick={() => sendTest('WHATSAPP')}
                disabled={testing !== null || !settings.whatsappNumber}
                style={{
                  padding: '10px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid #1a5c28',
                  color: testing === 'WHATSAPP' ? '#fbbf24' : '#4ade80',
                  whiteSpace: 'nowrap', fontWeight: 600,
                }}
              >
                {testing === 'WHATSAPP' ? '⏳ Enviando...' : '▶ Testar'}
              </button>
            </div>
            {testResult?.channel === 'WHATSAPP' && (
              <p style={{ fontSize: '12px', marginTop: '6px', color: testResult.success ? '#4ade80' : '#f87171' }}>
                {testResult.success ? '✅ Mensagem de teste enviada!' : '❌ Falha no envio. Verifique o número e a configuração da Evolution API.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Email ── */}
      <div style={{
        background: '#070f0a', border: '1px solid #0d2e14',
        borderRadius: '12px', padding: '20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📧</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2f0e8' }}>E-mail</div>
              <div style={{ fontSize: '11px', color: '#3d6b4a' }}>Alertas com template visual</div>
            </div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s, emailEnabled: !s.emailEnabled }))}
            style={{
              width: '44px', height: '24px', borderRadius: '100px',
              background: settings.emailEnabled ? '#10b981' : '#1a3a22',
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: settings.emailEnabled ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {settings.emailEnabled && (
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#5a9a68', fontWeight: 600, marginBottom: '7px', letterSpacing: '0.5px' }}>
              ENDEREÇO DE E-MAIL
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                style={{ ...inputStyle, flex: 1 }}
                placeholder="contato@suaempresa.com.br"
                value={settings.emailAddress ?? ''}
                onChange={e => setSettings(s => ({ ...s, emailAddress: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#10b981')}
                onBlur={e => (e.target.style.borderColor = '#1a5c28')}
              />
              <button
                onClick={() => sendTest('EMAIL')}
                disabled={testing !== null || !settings.emailAddress}
                style={{
                  padding: '10px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid #1a5c28',
                  color: testing === 'EMAIL' ? '#fbbf24' : '#4ade80',
                  whiteSpace: 'nowrap', fontWeight: 600,
                }}
              >
                {testing === 'EMAIL' ? '⏳ Enviando...' : '▶ Testar'}
              </button>
            </div>
            {testResult?.channel === 'EMAIL' && (
              <p style={{ fontSize: '12px', marginTop: '6px', color: testResult.success ? '#4ade80' : '#f87171' }}>
                {testResult.success ? '✅ E-mail de teste enviado!' : '❌ Falha no envio. Verifique as configurações SMTP.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Janelas de alerta ── */}
      <div style={{
        background: '#070f0a', border: '1px solid #0d2e14',
        borderRadius: '12px', padding: '20px', marginBottom: '24px',
      }}>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2f0e8', marginBottom: '4px' }}>
            📅 Dias de antecedência para alertar
          </div>
          <div style={{ fontSize: '12px', color: '#3d6b4a' }}>
            Selecione com quantos dias antes do vencimento receber notificações
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {AVAILABLE_DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                background: settings.alertDays.includes(day) ? '#0d2e14' : 'transparent',
                border: `1px solid ${settings.alertDays.includes(day) ? '#1a6b3a' : '#1a3a22'}`,
                color: settings.alertDays.includes(day) ? '#4ade80' : '#3d6b4a',
                fontFamily: 'monospace', fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {day}d
            </button>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#2a4a30', marginTop: '10px' }}>
          Além disso, alertas diários nos últimos {settings.dailyAlertDays} dias antes do vencimento e diariamente enquanto estiver vencida.
        </p>
      </div>

      {/* Erros */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
          fontSize: '13px', color: '#f87171',
        }}>{error}</div>
      )}

      {/* Botão salvar */}
      <button
        onClick={save}
        disabled={saving}
        style={{
          width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
          background: saved ? '#0d2e14' : 'linear-gradient(135deg, #059669, #10b981)',
          border: saved ? '1px solid #1a6b3a' : 'none',
          color: saved ? '#4ade80' : '#fff',
          cursor: saving ? 'wait' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {saving ? 'Salvando...' : saved ? '✅ Configurações salvas!' : 'Salvar configurações'}
      </button>
    </div>
  );
}
