// src/components/skeleton.tsx
// Primitiva de carga. Todavía no hay Suspense boundaries en las páginas (son Server
// Components que resuelven sus datos antes de renderizar) — este componente queda listo
// para cuando se introduzca streaming/Suspense en una fase posterior.

export function Skeleton({ width = '100%', height = 16 }: { width?: string | number; height?: string | number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background: 'linear-gradient(90deg, var(--c-light) 25%, #E8E6DC 37%, var(--c-light) 63%)',
        backgroundSize: '400% 100%',
      }}
    />
  );
}
