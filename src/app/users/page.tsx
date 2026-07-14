// src/app/users/page.tsx

import { AppShell } from '@/components/app-shell';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';
import { NewUserForm } from './new-user-form';
import { UsersTable } from './users-table';

export default async function UsersPage() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <AppShell>
        <p>No has iniciado sesión.</p>
      </AppShell>
    );
  }

  if (profile.appRole !== 'org_admin') {
    return (
      <AppShell>
        <h1>Usuarios</h1>
        <p>No tienes permisos para ver esta página. Solo un administrador puede gestionar usuarios.</p>
      </AppShell>
    );
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('organization_id', profile.organizationId)
    .order('created_at', { ascending: false });

  return (
    <AppShell>
      <h1>Usuarios</h1>
      <p style={{ color: 'var(--c-mid)' }}>
        Solo un administrador puede crear usuarios nuevos para tu organización.
      </p>

      <div className="card">
        <div className="card-title">Crear usuario</div>
        <NewUserForm />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '1.5rem 1.5rem 0' }}>
          Equipo ({users?.length ?? 0})
        </div>
        <UsersTable initialUsers={users ?? []} currentUserId={profile.userId} />
      </div>
    </AppShell>
  );
}
