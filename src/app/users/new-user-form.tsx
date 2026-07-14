// src/app/users/new-user-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function NewUserForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('evaluator');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el usuario.');

      setMessage(`Usuario "${fullName}" creado. Comunícale su email y esta contraseña temporal.`);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('evaluator');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Nombre completo</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: 6 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Contraseña temporal</label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          style={{ width: '100%', padding: 6 }}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Rol</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 6 }}>
          <option value="evaluator">Evaluador (uso normal de la herramienta)</option>
          <option value="org_admin">Administrador (puede crear más usuarios)</option>
          <option value="viewer">Visitante (solo puede ver, no puede editar nada)</option>
        </select>
      </div>
      <button type="submit" disabled={loading} className="btn btn-amber" style={{ width: 'fit-content' }}>
        {loading ? 'Creando...' : 'Crear usuario'}
      </button>
      {message && <p style={{ color: 'green', fontSize: 13 }}>{message}</p>}
      {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}
    </form>
  );
}
