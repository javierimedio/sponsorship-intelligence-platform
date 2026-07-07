// src/components/app-shell.tsx
import Link from 'next/link';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { SignOutButton } from '@/app/sign-out-button';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className="topbar">
        <div className="topbar-brand">
          <img
            src="https://paqtohmxagfebeyyurlq.supabase.co/storage/v1/object/public/assets/GORFACTORY_LOGO_BLANCO.png"
            alt="GOR Factory"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="brand-sep">|</span>
          <img
            src="https://static.gorfactory.es/images/header/logo_Roly_2025.svg"
            alt="Roly"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
          <img
            src="https://static.gorfactory.es/images/home/Logo_WRK_color.svg"
            alt="Roly WRK"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
          <img
            src="https://static.gorfactory.es/images/header/logo-stm-small.svg"
            alt="Stamina"
            style={{ filter: 'brightness(0) invert(1)', opacity: .6 }}
          />
        </div>

        <nav className="topbar-nav">
          <Link href="/">Inicio</Link>
          <Link href="/proposals">Propuestas</Link>
          <Link href="/intake">Nueva propuesta</Link>
        </nav>

        <div className="topbar-right">
          {user && <span>{user.email}</span>}
          <SignOutButton />
        </div>
      </div>

      <div className="main">{children}</div>
    </>
  );
}
