import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Proveedores } from '@/componentes/proveedores';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ERP Gasolinera', template: '%s · ERP Gasolinera' },
  description: 'Gastos administrativos, ventas e indicadores de la estación de servicio.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#111417' },
  ],
};

export default function RaizLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
