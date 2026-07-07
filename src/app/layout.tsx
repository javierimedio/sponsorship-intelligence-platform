import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GorFactory Collaboration Intelligence',
  description: 'Plataforma de gestión inteligente de colaboraciones corporativas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
