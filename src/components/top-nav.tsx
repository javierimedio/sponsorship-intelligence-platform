// src/components/top-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TopNavProps {
  showUsersLink?: boolean;
  isViewer?: boolean;
}

export function TopNav({ showUsersLink, isViewer }: TopNavProps) {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Dashboard' },
    { href: '/proposals', label: 'Propuestas' },
    { href: '/brands', label: 'Marcas' },
    ...(isViewer ? [] : [{ href: '/intake', label: 'Nueva propuesta' }]),
    ...(showUsersLink ? [{ href: '/users', label: 'Usuarios' }] : []),
  ];

  return (
    <nav className="topbar-nav">
      {items.map((item) => {
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
