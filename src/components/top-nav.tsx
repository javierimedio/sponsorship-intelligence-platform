// src/components/top-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio' },
  { href: '/proposals', label: 'Propuestas' },
  { href: '/intake', label: 'Nueva propuesta' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="topbar-nav">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={isActive ? 'active' : ''}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
