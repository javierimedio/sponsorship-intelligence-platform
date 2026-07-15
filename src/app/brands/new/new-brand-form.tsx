// src/app/brands/new/new-brand-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewBrandForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [businessModel, setBusinessModel] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, website, socialInstagram, socialFacebook, socialYoutube, businessModel, targetAudience }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al crear la marca.');
      router.push(`/brands/${data.id}/edit`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nombre de la marca *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Web</label>
        <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 8 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Instagram</label>
          <input type="text" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/..." style={{ width: '100%', padding: 8 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Facebook</label>
          <input type="text" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/..." style={{ width: '100%', padding: 8 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>YouTube</label>
          <input type="text" value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="https://youtube.com/..." style={{ width: '100%', padding: 8 }} />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Perfil comercial</label>
        <textarea
          value={businessModel}
          onChange={(e) => setBusinessModel(e.target.value)}
          rows={2}
          placeholder="ej: B2B exclusivo mediante distribuidores especializados"
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cliente potencial</label>
        <textarea
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          rows={2}
          placeholder="ej: Clubes deportivos, distribuidores y consumidor final joven"
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}

      <button type="submit" disabled={loading || !name.trim()} className="btn btn-amber" style={{ width: 'fit-content' }}>
        {loading ? 'Creando...' : 'Crear marca y continuar →'}
      </button>
    </form>
  );
}
