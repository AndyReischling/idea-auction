'use client';

import { useEffect } from 'react';
import setupUnifiedSystem from './lib/unified-system';
import MigrationUI from './components/MigrationUI';
import { useMigration } from './hooks/useMigration';
import BotManager from './components/BotManager';

function MigrationWrapper({ children }: { children: React.ReactNode }) {
  const migration = useMigration();

  return (
    <>
      <BotManager />
      {children}
      {migration.showUI && (
        <MigrationUI onClose={migration.hideMigrationUI} autoStart={false} />
      )}
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // Initialize once on the client
  useEffect(() => {
    setupUnifiedSystem();
  }, []);

  return <MigrationWrapper>{children}</MigrationWrapper>;
} 