'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { migrationTestingService } from '@/lib/migration-testing';
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
  Database,
} from '@phosphor-icons/react';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  timestamp: string;
  details?: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResults: TestResult[];
  dataIntegrityScore: number;
  performanceMetrics: {
    firebaseLatency: number;
    syncLatency: number;
  };
}

export default function MigrationTestRunner() {
  const { user } = useAuth();
  const [isRunning, setIsRunning]   = useState(false);
  const [results,  setResults]      = useState<ValidationResult | null>(null);
  const [isVisible, setIsVisible]   = useState(false);
  const [backupId, setBackupId]     = useState<string | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring,      setIsRestoring]      = useState(false);

  /* --------------------------------------------------------------------- */
  /*  helpers                                                              */
  /* --------------------------------------------------------------------- */
  const getStatusIcon = (ok: boolean) =>
    ok ? <CheckCircle size={20} className="text-green-500" /> :
         <X size={20} className="text-red-500" />;

  const scoreColour = (s: number) =>
    s >= 90 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';

  /* --------------------------------------------------------------------- */
  /*  actions                                                              */
  /* --------------------------------------------------------------------- */
  const runTests = async () => {
    if (!user) return;
    setIsRunning(true); setResults(null);
    try {
      const r = await migrationTestingService.runMigrationValidation(user.uid);
      setResults({
        ...r,
        performanceMetrics: {
          firebaseLatency : r.performanceMetrics.firebaseLatency,
          syncLatency     : r.performanceMetrics.syncLatency,
        },
      });
    } catch (err) {
      console.error(err);
      setResults({
        isValid : false,
        errors  : [err instanceof Error ? err.message : 'Test run failed'],
        warnings: [],
        testResults: [],
        dataIntegrityScore: 0,
        performanceMetrics: { firebaseLatency: -1, syncLatency: -1 },
      });
    } finally { setIsRunning(false); }
  };

  const createBackup = async () => {
    if (!user) return;
    setIsCreatingBackup(true);
    try {
      const id = await migrationTestingService.createBackup(
        user.uid,
        'Pre-migration test backup'
      );
      setBackupId(id);
    } finally { setIsCreatingBackup(false); }
  };

  const restoreBackup = async () => {
    if (!user || !backupId) return;
    setIsRestoring(true);
    try {
      await migrationTestingService.restoreFromBackup(backupId);
      window.location.reload();
    } finally { setIsRestoring(false); }
  };

  /* --------------------------------------------------------------------- */
  /*  render                                                               */
  /* --------------------------------------------------------------------- */
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        title="Test Migration"
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
      >
        <FlaskConical size={24} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* …unchanged header UI… */}

        {/* performance summary – legacy metric removed */}
        {results && (
          <div className="p-4 bg-gray-50 rounded-lg mt-4">
            <h3 className="font-medium text-gray-900 mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Firebase Latency:</span>
                <span className="ml-2 font-medium">
                  {results.performanceMetrics.firebaseLatency} ms
                </span>
              </div>
              <div>
                <span className="text-gray-600">Sync Latency:</span>
                <span className="ml-2 font-medium">
                  {results.performanceMetrics.syncLatency} ms
                </span>
              </div>
            </div>
          </div>
        )}

        {/* …rest of component identical except any refs to localStorageLatency removed… */}
      </div>
    </div>
  );
}
