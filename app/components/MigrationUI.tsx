'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { unifiedMigrationService } from '../lib/unified-migration';
import { conflictResolutionService } from '../lib/conflict-resolution';
import { 
  CloudArrowUp, 
  CloudCheck, 
  Warning, 
  X, 
  CheckCircle, 
  Clock, 
  Database,
  ArrowsClockwise,
  Download,
  Upload,
  Lightning,
  Shield,
  Gear
} from '@phosphor-icons/react';

interface MigrationStatus {
  stage: 'pending' | 'in_progress' | 'completed' | 'error' | 'rollback';
  progress: number;
  totalItems: number;
  completedItems: number;
  errors: string[];
  lastUpdate: string;
  dataTypes: {
    [key: string]: {
      status: 'pending' | 'migrating' | 'completed' | 'error';
      itemCount: number;
      migratedCount: number;
      errors: string[];
    };
  };
}

interface DataConflict {
  id: string;
  dataType: string;
  conflictType: 'value_mismatch' | 'missing_data' | 'timestamp_conflict' | 'structure_mismatch';
  localData: any;
  firebaseData: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
}

interface MigrationUIProps {
  onClose?: () => void;
  autoStart?: boolean;
}

export default function MigrationUI({ onClose, autoStart = false }: MigrationUIProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<'check' | 'migrate' | 'conflicts' | 'complete'>('check');
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  
  const { user } = useAuth();

  // Check if migration is needed
  useEffect(() => {
    const checkMigrationNeeded = async () => {
      if (!user) return;
      
      try {
        const needed = await unifiedMigrationService.isMigrationNeeded();
        setMigrationNeeded(needed);
        
        if (needed) {
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error checking migration status:', error);
      }
    };
    
    checkMigrationNeeded();
  }, [user]);

  // Auto-start migration if requested
  useEffect(() => {
    if (autoStart && migrationNeeded && user) {
      handleStartMigration();
    }
  }, [autoStart, migrationNeeded, user]);

  // Start migration process
  const handleStartMigration = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    setCurrentStep('migrate');
    
    try {
      console.log('🚀 Starting migration process...');
      
      // Start migration
      const result = await unifiedMigrationService.startMigration(user.uid);
      setMigrationStatus(result);
      
      // Check for conflicts
      const conflictResult = await conflictResolutionService.resolveAllConflicts(user.uid);
      
      if (conflictResult.userInputRequired.length > 0) {
        setConflicts(conflictResult.userInputRequired);
        setCurrentStep('conflicts');
      } else {
        setCurrentStep('complete');
      }
      
    } catch (error) {
      console.error('Migration failed:', error);
      setError(error instanceof Error ? error.message : 'Migration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle conflict resolution
  const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'firebase' | 'merge') => {
    if (!user) return;
    
    try {
      const success = await conflictResolutionService.resolveManualConflict(conflictId, resolution, user.uid);
      
      if (success) {
        setConflicts(prev => prev.filter(c => c.id !== conflictId));
        
        // Check if all conflicts are resolved
        if (conflicts.length === 1) {
          setCurrentStep('complete');
        }
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      setError(error instanceof Error ? error.message : 'Failed to resolve conflict');
    }
  };

  // Handle rollback
  const handleRollback = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await unifiedMigrationService.rollbackMigration(user.uid);
      setCurrentStep('check');
      setMigrationStatus(null);
    } catch (error) {
      console.error('Rollback failed:', error);
      setError(error instanceof Error ? error.message : 'Rollback failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsVisible(false);
    }
  };

  if (!isVisible || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <CloudArrowUp size={24} className="text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Firebase Migration
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Migration Check Step */}
          {currentStep === 'check' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Database size={32} className="text-blue-500" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Migrate to Firebase
                </h3>
                <p className="text-gray-600 mb-4">
                  Your data is currently stored locally. Migrating to Firebase will provide:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Real-time synchronization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Cross-device access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Automatic backups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span>Enhanced security</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleStartMigration}
                  disabled={isLoading}
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <ArrowsClockwise size={18} className="animate-spin" />
                      Starting Migration...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Start Migration
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}

          {/* Migration Progress Step */}
          {currentStep === 'migrate' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowsClockwise size={32} className="text-blue-500 animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Migrating Your Data
                </h3>
                <p className="text-gray-600">
                  Please wait while we transfer your data to Firebase...
                </p>
              </div>

              {migrationStatus && (
                <div className="space-y-4">
                  {/* Overall Progress */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Overall Progress</span>
                      <span>{Math.round(migrationStatus.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${migrationStatus.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Data Types Progress */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      <Gear size={16} />
                      {showDetails ? 'Hide' : 'Show'} Details
                    </button>
                    
                    {showDetails && (
                      <div className="space-y-2 text-sm">
                        {Object.entries(migrationStatus.dataTypes).map(([dataType, status]) => (
                          <div key={dataType} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="font-medium">{dataType}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">
                                {status.migratedCount}/{status.itemCount}
                              </span>
                              {status.status === 'completed' && (
                                <CheckCircle size={16} className="text-green-500" />
                              )}
                              {status.status === 'migrating' && (
                                <Clock size={16} className="text-blue-500" />
                              )}
                              {status.status === 'error' && (
                                <Warning size={16} className="text-red-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Errors */}
                  {migrationStatus.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                        <Warning size={16} />
                        Migration Errors
                      </div>
                      <ul className="text-sm text-red-600 space-y-1">
                        {migrationStatus.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conflict Resolution Step */}
          {currentStep === 'conflicts' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Warning size={32} className="text-yellow-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Resolve Data Conflicts
                </h3>
                <p className="text-gray-600">
                  Some data differences need your attention. Choose how to resolve each conflict:
                </p>
              </div>

              <div className="space-y-4">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{conflict.dataType}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        conflict.severity === 'high' ? 'bg-red-100 text-red-700' :
                        conflict.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {conflict.severity} priority
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {conflict.conflictType === 'value_mismatch' && 'Values differ between local and Firebase data'}
                      {conflict.conflictType === 'missing_data' && 'Data exists in one location but not the other'}
                      {conflict.conflictType === 'timestamp_conflict' && 'Timestamps indicate different update times'}
                      {conflict.conflictType === 'structure_mismatch' && 'Data structure differs between sources'}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'local')}
                        className="flex-1 bg-blue-500 text-white py-2 px-3 rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        Use Local Data
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'firebase')}
                        className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600 transition-colors"
                      >
                        Use Firebase Data
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conflict.id, 'merge')}
                        className="flex-1 bg-purple-500 text-white py-2 px-3 rounded text-sm hover:bg-purple-600 transition-colors"
                      >
                        Merge Both
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Step */}
          {currentStep === 'complete' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Migration Complete!
                </h3>
                <p className="text-gray-600 mb-4">
                  Your data has been successfully migrated to Firebase. You now have:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Lightning size={16} className="text-blue-500" />
                    <span>Real-time synchronization</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-green-500" />
                    <span>Secure cloud storage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CloudCheck size={16} className="text-purple-500" />
                    <span>Automatic backups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-orange-500" />
                    <span>Cross-device access</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleClose}
                  className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors"
                >
                  Continue Using App
                </button>
                
                <button
                  onClick={handleRollback}
                  disabled={isLoading}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <ArrowsClockwise size={16} className="animate-spin" />
                      Rolling back...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Rollback to Local Storage
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <Warning size={16} />
                Error
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 