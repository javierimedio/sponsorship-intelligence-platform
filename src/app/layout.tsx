import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GorFactory Collaboration Intelligence',
  description: 'Plataforma de gestión inteligente de colaboraciones corporativas',
  icons: {
    icon: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAgACADASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAQFAwb/xAAjEAACAQMEAwADAAAAAAAAAAABAgMABBESEyExBRRBIlFx/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOzopS7u5I5ore2jEk8gLfk2FVRjJJ/pHFJt5W5gmmjurZVEMasSjk7hYkKF4+kY5oK9FTfdvIZI1u7eFBMdEbJIWCvjIDcfcditPF3lxfQmWWBIkyVGH1FiCQT11xQZ+VV45YLmHcWRMqXSPcAU44ZRyRkDrqlbWzkv5byS6eUxyxoivo2zlSTlVPIAJGM9nNXKKCd6F1K8bXV2kmydUYWLSNWMBm55xnoYrbxtpJZWuzJMJcMSGCaezn9n6TTdFB//2Q==',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
