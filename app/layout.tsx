'use client';

import './global.css';
import { useEffect } from 'react';
import setupUnifiedSystem from './lib/unified-system';
import { AuthProvider } from './lib/auth-context';
import MigrationUI from './components/MigrationUI';
import { useMigration } from './hooks/useMigration';

function MigrationWrapper({ children }: { children: React.ReactNode }) {
  const migration = useMigration();

  return (
    <>
      {children}
      {migration.showUI && (
        <MigrationUI onClose={migration.hideMigrationUI} autoStart={false} />
      )}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Initialise once on the client
  useEffect(() => {
    setupUnifiedSystem();
  }, []);

  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <MigrationWrapper>{children}</MigrationWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
