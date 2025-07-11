/*
 * unified-migration.ts - Placeholder migration service
 * --------------------------------------------------------------
 * This is a placeholder service to prevent build errors.
 * The actual migration functionality has been refactored into other services.
 */

export interface MigrationStatus {
  stage: 'pending' | 'in_progress' | 'completed' | 'error' | 'rollback';
  progress: number;
  totalItems: number;
  completedItems: number;
  errors: string[];
  lastUpdate: string;
}

class UnifiedMigrationService {
  private static _instance: UnifiedMigrationService;
  
  static get instance() {
    return (this._instance ??= new UnifiedMigrationService());
  }

  async isMigrationNeeded(): Promise<boolean> {
    // Migration functionality has been refactored - return false to skip migration UI
    return false;
  }

  getMigrationStatus(): MigrationStatus {
    return {
      stage: 'completed',
      progress: 100,
      totalItems: 0,
      completedItems: 0,
      errors: [],
      lastUpdate: new Date().toISOString()
    };
  }

  async startMigration(userId: string): Promise<MigrationStatus> {
    console.log('Migration service called but functionality has been refactored');
    return this.getMigrationStatus();
  }

  async rollbackMigration(userId: string): Promise<void> {
    console.log('Rollback migration called but functionality has been refactored');
  }
}

export const unifiedMigrationService = UnifiedMigrationService.instance; 