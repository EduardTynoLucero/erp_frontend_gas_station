import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Proveedores } from '@/componentes/proveedores';
import { GUION_TEMA } from '@/lib/tema';
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
    // suppressHydrationWarning: el guion de <head> pone la clase `dark` en <html> antes de que React se monte
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Tema claro u oscuro antes del primer pintado, leído de su cookie */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body>
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
