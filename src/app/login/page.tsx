// src/app/login/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  async function handleReset() {
    if (!resetEmail) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(resetEmail);
    setResetSent(true);
  }

  return (
    <div className="auth-screen">
      <img
        src="https://paqtohmxagfebeyyurlq.supabase.co/storage/v1/object/public/assets/GORFACTORY_LOGO_BLANCO.png"
        alt="GOR Factory"
        className="auth-logo-top"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />

      <div className="auth-card">
        <div className="auth-title">Collaboration Intelligence Platform</div>
        <div className="auth-sub">Accede con tu correo corporativo</div>

        {error && <div className="auth-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              className="auth-input"
              placeholder="tu@gorfactory.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-form-group" style={{ marginBottom: '1.25rem' }}>
            <label>Contraseña</label>
            <input
              type="password"
              className="auth-input"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          className="auth-btn-outline"
          onClick={() => setShowReset((v) => !v)}
        >
          ¿Olvidaste tu contraseña?
        </button>

        {showReset && (
          <div style={{ marginTop: '1rem' }}>
            {resetSent ? (
              <div className="auth-alert-error" style={{ background: '#EAF3DE', color: '#3B6D11', borderLeftColor: '#3B6D11' }}>
                Si el correo existe, recibirás un enlace de recuperación.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Introduce tu correo"
                  style={{ marginBottom: '.5rem' }}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <button type="button" className="auth-btn-outline" onClick={handleReset}>
                  Enviar enlace de recuperación
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="auth-brands-bottom">
        <img src="https://static.gorfactory.es/images/header/logo_Roly_2025.svg" alt="Roly" />
        <img src="https://static.gorfactory.es/images/home/Logo_WRK_color.svg" alt="Roly WRK" />
        <img src="https://static.gorfactory.es/images/header/logo-stm-small.svg" alt="Stamina" />
      </div>
    </div>
  );
}
