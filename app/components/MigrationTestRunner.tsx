'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { migrationTestingService } from '../lib/migration-testing';
import { 
  PlayCircle, 
  CheckCircle, 
  X, 
  Warning, 
  Clock, 
  Download, 
  Upload,
  ArrowsClockwise,
  FlaskConical,
  Shield,
  Database
} from '@phosphor-icons/react';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResults: TestResult[];
  dataIntegrityScore: number;
  performanceMetrics: {
    firebaseLatency: number;
    localStorageLatency: number;
    syncLatency: number;
  };
}

export default function MigrationTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ValidationResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [backupId, setBackupId] = useState<string | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const { user } = useAuth();

  const runTests = async () => {
    if (!user) return;
    
    setIsRunning(true);
    setResults(null);
    
    try {
      console.log('🧪 Running migration validation tests...');
      const validationResults = await migrationTestingService.runMigrationValidation(user.uid);
      setResults(validationResults);
    } catch (error) {
      console.error('Test run failed:', error);
      setResults({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Test run failed'],
        warnings: [],
        testResults: [],
        dataIntegrityScore: 0,
        performanceMetrics: {
          firebaseLatency: -1,
          localStorageLatency: -1,
          syncLatency: -1
        }
      });
    } finally {
      setIsRunning(false);
    }
  };

  const createBackup = async () => {
    if (!user) return;
    
    setIsCreatingBackup(true);
    
    try {
      const backupId = await migrationTestingService.createBackup(user.uid, 'Pre-migration test backup');
      setBackupId(backupId);
      console.log('✅ Backup created:', backupId);
    } catch (error) {
      console.error('Backup creation failed:', error);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreFromBackup = async () => {
    if (!user || !backupId) return;
    
    setIsRestoring(true);
    
    try {
      await migrationTestingService.restoreFromBackup(backupId);
      console.log('✅ Restored from backup');
      // Reload page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    if (passed) {
      return <CheckCircle size={20} className="text-green-500" />;
    } else {
      return <X size={20} className="text-red-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
        title="Test Migration"
      >
        <FlaskConical size={24} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FlaskConical size={24} className="text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Migration Test Runner
            </h2>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Control Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={runTests}
              disabled={isRunning || !user}
              className="bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <PlayCircle size={18} />
                  Run Tests
                </>
              )}
            </button>
            
            <button
              onClick={createBackup}
              disabled={isCreatingBackup || !user}
              className="bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isCreatingBackup ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Create Backup
                </>
              )}
            </button>
            
            <button
              onClick={restoreFromBackup}
              disabled={isRestoring || !backupId}
              className="bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isRestoring ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Restore Backup
                </>
              )}
            </button>
          </div>

          {/* Backup Status */}
          {backupId && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <Shield size={18} />
                <span className="font-medium">Backup Created</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Backup ID: {backupId}
              </p>
            </div>
          )}

          {/* Test Results */}
          {results && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Database size={18} className="text-blue-500" />
                    <span className="font-medium">Overall Status</span>
                  </div>
                  <div className="mt-2">
                    <span className={`text-2xl font-bold ${results.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {results.isValid ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500" />
                    <span className="font-medium">Data Integrity</span>
                  </div>
                  <div className="mt-2">
                    <span className={`text-2xl font-bold ${getScoreColor(results.dataIntegrityScore)}`}>
                      {results.dataIntegrityScore}%
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-purple-500" />
                    <span className="font-medium">Performance</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">
                      Firebase: {results.performanceMetrics.firebaseLatency}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {results.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <X size={18} />
                    Errors ({results.errors.length})
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {results.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {results.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
                    <Warning size={18} />
                    Warnings ({results.warnings.length})
                  </div>
                  <ul className="text-sm text-yellow-600 space-y-1">
                    {results.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Test Results */}
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Test Results</h3>
                <div className="space-y-2">
                  {results.testResults.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(test.passed)}
                        <span className="font-medium">{test.testName}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{test.message}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(test.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Firebase Latency:</span>
                    <span className="ml-2 font-medium">
                      {results.performanceMetrics.firebaseLatency}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">LocalStorage Latency:</span>
                    <span className="ml-2 font-medium">
                      {results.performanceMetrics.localStorageLatency}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Sync Latency:</span>
                    <span className="ml-2 font-medium">
                      {results.performanceMetrics.syncLatency}ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {!results && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Migration Testing</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Run tests to validate your migration</li>
                <li>• Create a backup before making changes</li>
                <li>• Restore from backup if issues occur</li>
                <li>• Tests check data integrity, performance, and functionality</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 