// src/components/inline-editable.tsx
'use client';

import { useState } from 'react';

interface InlineEditableProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  as?: 'input' | 'textarea';
  fontSize?: number;
  fontWeight?: number;
}

export function InlineEditable({ value, onSave, placeholder, as = 'input', fontSize = 14, fontWeight = 400 }: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    setSaving(true);
    try {
      if (draft.trim() && draft !== value) {
        await onSave(draft.trim());
      } else {
        setDraft(value);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <span
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Clic para editar"
        style={{ fontSize, fontWeight, cursor: 'text', borderBottom: '1px dashed transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--c-line)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
      >
        {value || <span style={{ color: 'var(--c-mid)' }}>{placeholder ?? 'Sin definir'}</span>}
      </span>
    );
  }

  const commonProps = {
    autoFocus: true,
    value: draft,
    disabled: saving,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    style: { fontSize, fontWeight, padding: '2px 6px', border: '1px solid var(--c-amber)', borderRadius: 4, fontFamily: 'inherit' },
  };

  if (as === 'textarea') {
    return (
      <textarea
        {...commonProps}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <input
      {...commonProps}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
