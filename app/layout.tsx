'use client';

import './components/GlobalActivityTracker'; // This loads the global functions
import { useEffect } from 'react';
import './global.css';
import setupUnifiedSystem from './lib/unified-system';
import { AuthProvider } from './lib/auth-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize the unified system on app load
  useEffect(() => {
    // console.log('🔧 Initializing unified system from layout...');
    setupUnifiedSystem();
  }, []);

  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}