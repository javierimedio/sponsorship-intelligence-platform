// src/app/users/users-table.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  org_admin: 'Administrador',
  evaluator: 'Evaluador',
  viewer: 'Visitante',
};

export function UsersTable({ initialUsers, currentUserId }: { initialUsers: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('evaluator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setFullName(u.full_name ?? '');
    setEmail(u.email ?? '');
    setRole(u.role);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar los cambios.');

      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>Alta</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {initialUsers.map((u) => {
          const isEditing = editingId === u.id;
          const isSelf = u.id === currentUserId;

          if (isEditing) {
            return (
              <tr key={u.id}>
                <td>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 13 }} />
                </td>
                <td>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 13 }} />
                </td>
                <td>
                  <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 13 }}>
                    <option value="evaluator">Evaluador</option>
                    <option value="org_admin">Administrador</option>
                    <option value="viewer">Visitante</option>
                  </select>
                </td>
                <td style={{ color: 'var(--c-mid)', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => saveEdit(u.id)} disabled={loading} className="btn btn-amber" style={{ padding: '.3rem .7rem', fontSize: 12, marginRight: 6 }}>
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={cancelEdit} disabled={loading} className="btn btn-outline" style={{ padding: '.3rem .7rem', fontSize: 12 }}>
                    Cancelar
                  </button>
                  {error && <div style={{ color: 'crimson', fontSize: 11, marginTop: 4 }}>{error}</div>}
                </td>
              </tr>
            );
          }

          return (
            <tr key={u.id}>
              <td>{u.full_name ?? '—'}</td>
              <td>{u.email ?? '—'}</td>
              <td>{ROLE_LABEL[u.role] ?? u.role}</td>
              <td style={{ color: 'var(--c-mid)', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
              <td>
                {isSelf ? (
                  <span title="No puedes editar tu propio usuario desde aquí — pide a otro administrador que lo haga." style={{ fontSize: 12, color: 'var(--c-mid)' }}>
                    (tú)
                  </span>
                ) : (
                  <button onClick={() => startEdit(u)} className="btn btn-outline" style={{ padding: '.3rem .7rem', fontSize: 12 }}>
                    Editar
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
