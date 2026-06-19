import React, { useState, FormEvent } from 'react';
import { useAuth } from '../store/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // AuthContext atualiza isAuthenticated → Router redireciona automaticamente
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao conectar. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050c07',
      display: 'flex',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>

      {/* ── Painel esquerdo — identidade visual ── */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #071209 0%, #0a2014 50%, #061009 100%)',
        borderRight: '1px solid #0d2e14',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoração de fundo */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, #10b981 39px, #10b981 40px),
                            repeating-linear-gradient(90deg, transparent, transparent 39px, #10b981 39px, #10b981 40px)`,
        }} />
        <div style={{
          position: 'absolute', bottom: '-120px', right: '-120px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', boxShadow: '0 0 20px rgba(16,185,129,0.3)',
            }}>⛽</div>
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '18px', color: '#10b981', letterSpacing: '2px' }}>
                VALINEXUS
              </div>
              <div style={{ fontSize: '11px', color: '#3d6b4a', letterSpacing: '1px' }}>MACAPÁ · AMAPÁ</div>
            </div>
          </div>
        </div>

        {/* Headline central */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '11px', color: '#10b981', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px', fontFamily: 'monospace' }}>
            Gestão de Conformidade
          </p>
          <h1 style={{ fontSize: '38px', fontWeight: 800, color: '#e2f0e8', lineHeight: 1.15, margin: '0 0 20px' }}>
            Sua cadeia Petrobras<br />
            <span style={{ color: '#10b981' }}>sempre em dia.</span>
          </h1>
          <p style={{ fontSize: '15px', color: '#4a7a54', lineHeight: 1.7, maxWidth: '360px' }}>
            Monitore certidões, receba alertas automáticos via WhatsApp e
            nunca perca um contrato por documento vencido.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '32px', marginTop: '40px' }}>
            {[
              { num: '47+', label: 'Certidões monitoradas' },
              { num: '30d', label: 'Antecedência de alerta' },
              { num: '100%', label: 'Conformidade CRC' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '22px', color: '#10b981' }}>{s.num}</div>
                <div style={{ fontSize: '11px', color: '#3d6b4a', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '11px', color: '#1a4a28', fontFamily: 'monospace' }}>
            © 2026 VALINEXUS · Macapá, AP
          </p>
        </div>
      </div>

      {/* ── Painel direito — formulário de login ── */}
      <div style={{
        width: '440px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 48px',
        background: '#060d08',
      }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#e2f0e8', margin: '0 0 8px' }}>
            Entrar na plataforma
          </h2>
          <p style={{ fontSize: '14px', color: '#3d6b4a', margin: 0 }}>
            Use as credenciais fornecidas pelo seu consultor VALINEXUS
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Campo E-mail */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#5a9a68', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>
              E-MAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              required
              autoComplete="email"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '8px',
                background: '#0a1a0e', border: `1px solid ${error ? '#7f1d1d' : '#1a5c28'}`,
                color: '#e2f0e8', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#10b981'; }}
              onBlur={e => { e.target.style.borderColor = error ? '#7f1d1d' : '#1a5c28'; }}
            />
          </div>

          {/* Campo Senha */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#5a9a68', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>
              SENHA
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '12px 44px 12px 16px', borderRadius: '8px',
                  background: '#0a1a0e', border: `1px solid ${error ? '#7f1d1d' : '#1a5c28'}`,
                  color: '#e2f0e8', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#10b981'; }}
                onBlur={e => { e.target.style.borderColor = error ? '#7f1d1d' : '#1a5c28'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#3d6b4a', fontSize: '16px', padding: '4px',
                }}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div style={{
              marginBottom: '18px', padding: '12px 16px', borderRadius: '8px',
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '14px' }}>🔴</span>
              <span style={{ fontSize: '13px', color: '#f87171' }}>{error}</span>
            </div>
          )}

          {/* Botão de submit */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%', padding: '13px', borderRadius: '8px',
              background: loading || !email || !password
                ? '#0a2014'
                : 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none',
              color: loading || !email || !password ? '#1a5c28' : '#fff',
              fontSize: '14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.2s', letterSpacing: '0.5px',
              boxShadow: loading ? 'none' : '0 0 20px rgba(16,185,129,0.2)',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  width: '14px', height: '14px', border: '2px solid #1a5c28',
                  borderTop: '2px solid #10b981', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', display: 'inline-block',
                }} />
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        </form>

        {/* Contato de suporte */}
        <div style={{
          marginTop: '40px', padding: '16px', borderRadius: '8px',
          background: '#0a1a0e', border: '1px solid #0d2e14',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '12px', color: '#3d6b4a', margin: '0 0 4px' }}>Problemas para acessar?</p>
          <a
            href="https://wa.me/5596999113575"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: '#10b981', textDecoration: 'none', fontWeight: 600 }}
          >
            💬 Falar com o suporte via WhatsApp
          </a>
        </div>
      </div>

    </div>
  );
}
