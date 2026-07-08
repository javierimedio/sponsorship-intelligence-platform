// src/app/api/ai-providers/route.ts
// Informa a la UI de qué proveedores están realmente utilizables (clave configurada
// en Vercel), sin exponer las claves en sí — solo un booleano por proveedor.

import { NextResponse } from 'next/server';

export async function GET() {
  const providers = [
    { id: 'manual', label: 'Manual (sin IA)', configured: true },
    { id: 'openai', label: 'OpenAI (solo imágenes, no PDF)', configured: Boolean(process.env.OPENAI_API_KEY) },
    { id: 'gemini', label: 'Gemini', configured: Boolean(process.env.GEMINI_API_KEY) },
    { id: 'anthropic', label: 'Claude (Anthropic)', configured: Boolean(process.env.ANTHROPIC_API_KEY) },
  ];

  return NextResponse.json({
    providers,
    default: (process.env.AI_PROVIDER ?? 'manual').toLowerCase(),
  });
}
