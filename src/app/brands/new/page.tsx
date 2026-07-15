// src/app/brands/new/page.tsx

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { NewBrandForm } from './new-brand-form';

export default function NewBrandPage() {
  return (
    <AppShell>
      <p>
        <Link href="/brands">← Volver a marcas</Link>
      </p>
      <h1>Nueva marca</h1>
      <p style={{ color: 'var(--c-mid)' }}>
        Solo lo básico por ahora — en el siguiente paso podrás completar el resto del perfil a mano o con IA.
      </p>
      <div className="card" style={{ maxWidth: 640 }}>
        <NewBrandForm />
      </div>
    </AppShell>
  );
}
