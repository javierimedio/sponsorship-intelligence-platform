// src/components/app-shell.tsx
// Cabecera reutilizable en todas las páginas autenticadas. Es un Server Component
// (async): lee la sesión y el perfil directamente, en vez de que cada página tenga
// que pasárselos.

import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { SignOutButton } from '@/app/sign-out-button';
import { TopNav } from './top-nav';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    displayName = profile?.full_name ?? null;
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-brand">
          <img
            className="brand-logo-main"
            src="https://paqtohmxagfebeyyurlq.supabase.co/storage/v1/object/public/assets/GORFACTORY_LOGO_BLANCO.png"
            alt="GOR Factory"
          />
          <span className="topbar-tool-name">Sponsorship Intelligence Platform</span>
          <span className="brand-sep">|</span>
          <img
            className="brand-logo-mini"
            src="https://static.gorfactory.es/images/header/logo_Roly_2025.svg"
            alt="Roly"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
          <img
            className="brand-logo-mini"
            src="https://static.gorfactory.es/images/home/Logo_WRK_color.svg"
            alt="Roly WRK"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
          <img
            className="brand-logo-mini"
            src="https://static.gorfactory.es/images/header/logo-stm-small.svg"
            alt="Stamina"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
        </div>

        <TopNav />

        <div className="topbar-right">
          {user && (
            <span>
              {displayName ? <strong>{displayName}</strong> : null}
              {displayName ? ' · ' : ''}
              {user.email}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>

      <div className="main">{children}</div>
    </>
  );
}
