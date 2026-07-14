// src/app/api/users/[id]/route.ts
// Editar un usuario existente — solo un org_admin de la misma organización. Igual que la
// creación, usa la clave de servicio: cambiar el email de OTRO usuario en auth.users no es
// algo que la sesión de ese usuario permita hacer, hace falta la Admin API.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server-client';
import { createSupabaseAdminClient } from '@/infrastructure/supabase/admin-client';
import { getCurrentProfile } from '@/infrastructure/supabase/current-profile';

const ALLOWED_ROLES = ['org_admin', 'evaluator', 'viewer'];

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createSupabaseServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: 'No autenticado o sin perfil de negocio.' }, { status: 401 });
  }
  if (profile.appRole !== 'org_admin') {
    return NextResponse.json({ error: 'Solo un administrador puede editar usuarios.' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  // Comprobación de pertenencia: el usuario a editar tiene que ser de la misma organización
  // — sin esto, un org_admin podría editar usuarios de otra organización por id a ciegas.
  const { data: target } = await admin
    .from('profiles')
    .select('id, organization_id, email')
    .eq('id', params.id)
    .maybeSingle();

  if (!target || target.organization_id !== profile.organizationId) {
    return NextResponse.json({ error: 'Usuario no encontrado en tu organización.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (typeof body?.fullName === 'string' && body.fullName.trim()) {
    updates.full_name = body.fullName.trim();
  }
  if (typeof body?.role === 'string' && ALLOWED_ROLES.includes(body.role)) {
    updates.role = body.role;
  }

  let newEmail: string | null = null;
  if (typeof body?.email === 'string' && body.email.trim().toLowerCase() !== target.email) {
    newEmail = body.email.trim().toLowerCase();
  }

  if (newEmail) {
    const { error: emailError } = await admin.auth.admin.updateUserById(params.id, { email: newEmail });
    if (emailError) {
      return NextResponse.json({ error: `Error al actualizar el email: ${emailError.message}` }, { status: 500 });
    }
    updates.email = newEmail;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: true }); // nada que cambiar
  }

  const { error: updateError } = await admin.from('profiles').update(updates).eq('id', params.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
