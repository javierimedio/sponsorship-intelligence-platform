// src/app/api/users/route.ts
// Solo un perfil con role='org_admin' puede crear o listar usuarios de su organización.
// La creación usa la clave de servicio (bypassa RLS) porque insertar en auth.users y
// vincular el perfil correspondiente no es algo que un usuario normal deba poder hacer
// desde el cliente — por diseño, `profiles` no tiene política de INSERT para nadie más.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { createSupabaseAdminClient } from '@/infrastructure/supabase/admin-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

const ALLOWED_ROLES = ['org_admin', 'evaluator', 'viewer'];

export async function GET() {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }
  if (profile.appRole !== 'org_admin') {
    return NextResponse.json({ error: 'Solo un administrador puede ver esta lista.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('organization_id', profile.organizationId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }
  if (profile.appRole !== 'org_admin') {
    return NextResponse.json({ error: 'Solo un administrador puede crear usuarios.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const role = ALLOWED_ROLES.includes(body?.role) ? body.role : 'evaluator';

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'email, password y fullName son obligatorios.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña temporal debe tener al menos 8 caracteres.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // sin esto, el usuario nuevo no podría iniciar sesión hasta confirmar por correo
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'Error al crear el usuario.' }, { status: 500 });
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    tenant_id: profile.tenantId,
    organization_id: profile.organizationId,
    full_name: fullName,
    email,
    role,
  });

  if (profileError) {
    // Si falla el perfil, no dejamos un usuario de Auth huérfano sin perfil de negocio.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Error al crear el perfil: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ id: created.user.id, email, fullName, role });
}
