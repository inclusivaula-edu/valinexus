/**
 * pages/ChangePasswordPage.tsx
 *
 * Tela de troca de senha. Usada em dois contextos:
 *
 * 1. OBRIGATÓRIO (primeiro acesso) — quando user.mustChangePassword === true.
 *    O ForcePasswordChange guard intercepta antes do dashboard e mostra
 *    esta tela sem opção de pular. É o que torna seguras as senhas
 *    temporárias geradas pelo seed.ts e comunicadas via WhatsApp.
 *
 * 2. VOLUNTÁRIO — acessível a qualquer momento pelas configurações,
 *    quando o usuário decide trocar a senha por iniciativa própria.
 *
 * Em ambos os casos, o backend revoga TODAS as sessões ao trocar a senha
 * (changePassword no auth.service.ts) — então depois de trocar, sempre
 * pedimos para o usuário fazer login de novo com a nova senha. Isso é
 * intencional: garante que nenhuma sessão antiga (possivelmente
 * comprometida) continue válida.
 */

import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../services/api';
import { useAuth } from '../store/AuthContext';
import { validatePasswordStrength } from '@valinexus/shared';

interface Props {
  /** true = primeiro acesso, sem botão de cancelar/pular */
  mandatory?: boolean;
}

export default function ChangePasswordPage({ mandatory = false }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validação de força em tempo real — mesma regra do backend (@valinexus/shared)
  const strength = newPassword ? validatePasswordStrength(newPassword) : null;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isSameAsCurrent = currentPassword.length > 0 && currentPassword === newPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    strength?.valid === true &&
    passwordsMatch &&
    !isSameAsCurrent;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });

      // O backend revogou todas as sessões (incluindo a atual) por segurança.
      // Limpamos o token local e mostramos a confirmação antes de redirecionar.
      setAccessToken(null);
      setSuccess(true);

      // Aguarda 2s mostrando a confirmação, depois manda para o login
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);

    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao trocar a senha. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 44px 12px 16px', borderRadius: '8px',
    background: '#0a1a0e', border: '1px solid #1a5c28',
    color: '#e2f0e8', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', color: '#5a9a68', fontWeight: 600,
    marginBottom: '8px', letterSpacing: '0.5px',
  };

  // ── Tela de sucesso ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050c07', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '48px' }}>✅</div>
        <h2 style={{ color: '#4ade80', fontSize: '20px', fontWeight: 700, margin: 0 }}>
          Senha alterada com sucesso!
        </h2>
        <p style={{ color: '#4a7a54', fontSize: '13px' }}>
          Redirecionando para o login...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050c07', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>
      <div style={{
        width: '440px', maxWidth: '100%', background: '#060d08',
        border: '1px solid #1a5c28', borderRadius: '16px', padding: '36px',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px', margin: '0 auto 16px',
            background: mandatory ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${mandatory ? '#92400e' : '#1a5c28'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          }}>{mandatory ? '🔐' : '🔑'}</div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#e2f0e8', margin: '0 0 8px' }}>
            {mandatory ? 'Defina sua senha definitiva' : 'Trocar senha'}
          </h2>
          <p style={{ fontSize: '13px', color: '#4a7a54', margin: 0, lineHeight: 1.6 }}>
            {mandatory
              ? `Olá, ${user?.name ?? ''}! Por segurança, você precisa definir uma nova senha antes de continuar. A senha temporária não pode ser usada permanentemente.`
              : 'Escolha uma nova senha para sua conta.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Senha atual */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              {mandatory ? 'SENHA TEMPORÁRIA (recebida no onboarding)' : 'SENHA ATUAL'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#10b981')}
                onBlur={e => (e.target.style.borderColor = '#1a5c28')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#3d6b4a', fontSize: '16px',
                }}
              >{showCurrent ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {/* Nova senha */}
          <div style={{ marginBottom: '8px' }}>
            <label style={labelStyle}>NOVA SENHA</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, com letra e número"
                required
                autoComplete="new-password"
                style={{
                  ...inputStyle,
                  borderColor: newPassword.length > 0
                    ? (strength?.valid ? '#1a6b3a' : '#7f1d1d')
                    : '#1a5c28',
                }}
                onFocus={e => (e.target.style.borderColor = '#10b981')}
                onBlur={e => (e.target.style.borderColor = newPassword.length > 0
                  ? (strength?.valid ? '#1a6b3a' : '#7f1d1d') : '#1a5c28')}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#3d6b4a', fontSize: '16px',
                }}
              >{showNew ? '🙈' : '👁️'}</button>
            </div>
            {newPassword.length > 0 && !strength?.valid && (
              <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>{strength?.reason}</p>
            )}
            {isSameAsCurrent && (
              <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>
                A nova senha deve ser diferente da senha atual
              </p>
            )}
          </div>

          {/* Indicadores de força — feedback visual imediato */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
            {[
              { ok: newPassword.length >= 8, label: '8+ caracteres' },
              { ok: /[a-zA-Z]/.test(newPassword), label: 'Letra' },
              { ok: /[0-9]/.test(newPassword), label: 'Número' },
            ].map(req => (
              <div key={req.label} style={{
                flex: 1, padding: '6px 8px', borderRadius: '6px', textAlign: 'center',
                background: req.ok ? 'rgba(16,185,129,0.1)' : '#0a1a0e',
                border: `1px solid ${req.ok ? '#1a6b3a' : '#1a3a22'}`,
                fontSize: '10px', color: req.ok ? '#4ade80' : '#3d6b4a',
              }}>{req.ok ? '✓' : '○'} {req.label}</div>
            ))}
          </div>

          {/* Confirmar senha */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>CONFIRMAR NOVA SENHA</label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              required
              autoComplete="new-password"
              style={{
                ...inputStyle, paddingRight: '16px',
                borderColor: confirmPassword.length > 0
                  ? (passwordsMatch ? '#1a6b3a' : '#7f1d1d')
                  : '#1a5c28',
              }}
              onFocus={e => (e.target.style.borderColor = '#10b981')}
              onBlur={e => (e.target.style.borderColor = confirmPassword.length > 0
                ? (passwordsMatch ? '#1a6b3a' : '#7f1d1d') : '#1a5c28')}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>As senhas não coincidem</p>
            )}
          </div>

          {/* Erro da API */}
          {error && (
            <div style={{
              marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
              fontSize: '13px', color: '#f87171',
            }}>{error}</div>
          )}

          {/* Aviso de segurança */}
          <div style={{
            marginBottom: '20px', padding: '12px 14px', borderRadius: '8px',
            background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
            fontSize: '12px', color: '#fbbf24', lineHeight: 1.6,
          }}>
            ℹ️ Por segurança, ao trocar a senha você será desconectado de todos os
            dispositivos e precisará fazer login novamente.
          </div>

          {/* Botões */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            style={{
              width: '100%', padding: '13px', borderRadius: '8px',
              background: canSubmit && !loading
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : '#0a2014',
              border: 'none',
              color: canSubmit && !loading ? '#fff' : '#1a5c28',
              fontSize: '14px', fontWeight: 700,
              cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Salvando...' : 'Confirmar nova senha'}
          </button>

          {!mandatory && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                width: '100%', padding: '11px', marginTop: '10px', borderRadius: '8px',
                background: 'transparent', border: '1px solid #1a3a22',
                color: '#3d6b4a', fontSize: '13px', cursor: 'pointer',
              }}
            >Cancelar</button>
          )}

          {mandatory && (
            <button
              type="button"
              onClick={logout}
              style={{
                width: '100%', padding: '11px', marginTop: '10px', borderRadius: '8px',
                background: 'transparent', border: 'none',
                color: '#3d6b4a', fontSize: '12px', cursor: 'pointer',
              }}
            >Sair e entrar com outra conta</button>
          )}
        </form>
      </div>
    </div>
  );
}
