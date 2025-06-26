/* app/layout.tsx ----------------------------------------------- */
import Sidebar from './components/Sidebar';

export const metadata = { title: 'Random Opinion Generator' };

import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


