'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import { unifiedMigrationService } from '../lib/unified-migration';
import { conflictResolutionService } from '../lib/conflict-resolution';

interface MigrationState {
  isNeeded: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
  hasErrors: boolean;
  progress: number;
  errors: string[];
  conflicts: any[];
  showUI: boolean;
}

interface MigrationActions {
  startMigration: () => Promise<void>;
  rollbackMigration: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'firebase' | 'merge') => Promise<void>;
  checkMigrationStatus: () => Promise<void>;
  showMigrationUI: () => void;
  hideMigrationUI: () => void;
}

export function useMigration(): MigrationState & MigrationActions {
  const [state, setState] = useState<MigrationState>({
    isNeeded: false,
    isInProgress: false,
    isCompleted: false,
    hasErrors: false,
    progress: 0,
    errors: [],
    conflicts: [],
    showUI: false
  });

  const { user } = useAuth();

  // Check if migration is needed
  const checkMigrationStatus = useCallback(async () => {
    if (!user) return;

    try {
      const isNeeded = await unifiedMigrationService.isMigrationNeeded();
      const currentStatus = unifiedMigrationService.getMigrationStatus();
      
      setState(prev => ({
        ...prev,
        isNeeded,
        isInProgress: currentStatus.stage === 'in_progress',
        isCompleted: currentStatus.stage === 'completed',
        hasErrors: currentStatus.errors.length > 0,
        progress: currentStatus.progress,
        errors: currentStatus.errors
      }));
    } catch (error) {
      console.error('Error checking migration status:', error);
      setState(prev => ({
        ...prev,
        hasErrors: true,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }));
    }
  }, [user]);

  // Start migration
  const startMigration = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      isInProgress: true,
      hasErrors: false,
      errors: []
    }));

    try {
      const result = await unifiedMigrationService.startMigration(user.uid);
      
      // Check for conflicts
      const conflictResult = await conflictResolutionService.resolveAllConflicts(user.uid);
      
      setState(prev => ({
        ...prev,
        isInProgress: result.stage === 'in_progress',
        isCompleted: result.stage === 'completed',
        hasErrors: result.errors.length > 0,
        progress: result.progress,
        errors: result.errors,
        conflicts: conflictResult.userInputRequired || []
      }));
    } catch (error) {
      console.error('Migration failed:', error);
      setState(prev => ({
        ...prev,
        isInProgress: false,
        hasErrors: true,
        errors: [error instanceof Error ? error.message : 'Migration failed']
      }));
    }
  }, [user]);

  // Rollback migration
  const rollbackMigration = useCallback(async () => {
    if (!user) return;

    try {
      await unifiedMigrationService.rollbackMigration(user.uid);
      
      setState(prev => ({
        ...prev,
        isInProgress: false,
        isCompleted: false,
        hasErrors: false,
        progress: 0,
        errors: [],
        conflicts: []
      }));
    } catch (error) {
      console.error('Rollback failed:', error);
      setState(prev => ({
        ...prev,
        hasErrors: true,
        errors: [error instanceof Error ? error.message : 'Rollback failed']
      }));
    }
  }, [user]);

  // Resolve conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: 'local' | 'firebase' | 'merge') => {
    if (!user) return;

    try {
      const success = await conflictResolutionService.resolveManualConflict(conflictId, resolution, user.uid);
      
      if (success) {
        setState(prev => ({
          ...prev,
          conflicts: prev.conflicts.filter(c => c.id !== conflictId)
        }));
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      setState(prev => ({
        ...prev,
        hasErrors: true,
        errors: [...prev.errors, error instanceof Error ? error.message : 'Failed to resolve conflict']
      }));
    }
  }, [user]);

  // Show migration UI
  const showMigrationUI = useCallback(() => {
    setState(prev => ({
      ...prev,
      showUI: true
    }));
  }, []);

  // Hide migration UI
  const hideMigrationUI = useCallback(() => {
    setState(prev => ({
      ...prev,
      showUI: false
    }));
  }, []);

  // Check migration status on mount and when user changes
  useEffect(() => {
    checkMigrationStatus();
  }, [checkMigrationStatus]);

  // Auto-show migration UI if needed
  useEffect(() => {
    if (state.isNeeded && !state.isCompleted) {
      // Auto-show after a short delay to avoid interrupting initial load
      const timer = setTimeout(() => {
        showMigrationUI();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [state.isNeeded, state.isCompleted, showMigrationUI]);

  return {
    ...state,
    startMigration,
    rollbackMigration,
    resolveConflict,
    checkMigrationStatus,
    showMigrationUI,
    hideMigrationUI
  };
} 