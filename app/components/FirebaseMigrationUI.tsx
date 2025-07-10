'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { runMigration, MigrationResult } from '../lib/firebase-migration';

interface MigrationUIProps {
  onComplete?: () => void;
}

export default function FirebaseMigrationUI({ onComplete }: MigrationUIProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [localStorageData, setLocalStorageData] = useState<{ [key: string]: any }>({});
  const [hasLocalData, setHasLocalData] = useState(false);
  const { user } = useAuth();

  // Check for localStorage data on component mount
  useEffect(() => {
    analyzeLocalStorage();
  }, []);

  const analyzeLocalStorage = () => {
    if (typeof window === 'undefined') return;
    
    setIsAnalyzing(true);
    
    const keys = [
      'userProfile', 'opinions', 'opinionMarketData', 'transactions', 'globalActivityFeed',
      'botTransactions', 'ownedOpinions', 'advancedBets', 'shortPositions', 'autonomousBots',
      'botOpinions', 'portfolioSnapshots', 'semanticEmbeddings', 'otherUsers', 'activityFeed',
      'opinionAttributions', 'botsAutoStart', 'botsInitialized'
    ];

    const data: { [key: string]: any } = {};
    let hasData = false;

    keys.forEach(key => {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const count = Array.isArray(parsed) ? parsed.length : 
                       typeof parsed === 'object' ? Object.keys(parsed).length : 
                       parsed ? 1 : 0;
          
          if (count > 0) {
            data[key] = { count, preview: parsed };
            hasData = true;
          }
        }
      } catch (error) {
        console.error(`Error analyzing localStorage key ${key}:`, error);
      }
    });

    setLocalStorageData(data);
    setHasLocalData(hasData);
    setIsAnalyzing(false);
  };

  const handleMigration = async () => {
    if (!user?.uid) {
      alert('Please sign in to migrate your data');
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const result = await runMigration(user.uid);
      setMigrationResult(result);
      
      if (result.success && onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationResult({
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        migratedKeys: [],
        errors: [error instanceof Error ? error.message : String(error)],
        totalItemsMigrated: 0
      });
    } finally {
      setIsMigrating(false);
    }
  };

  if (!user) {
    return (
      <div className="migration-ui" style={{ padding: '20px', textAlign: 'center' }}>
        <h2>🔐 Sign In Required</h2>
        <p>Please sign in to migrate your localStorage data to Firebase.</p>
      </div>
    );
  }

  return (
    <div className="migration-ui" style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e5e7eb'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>
        🚀 Migrate to Firebase
      </h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '16px', color: '#4b5563', marginBottom: '15px' }}>
          This will migrate all your localStorage data to Firebase for persistent storage across devices and sessions.
        </p>
      </div>

      {isAnalyzing ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>🔍 Analyzing localStorage...</div>
          <div>Checking for data to migrate...</div>
        </div>
      ) : !hasLocalData ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>✅ No Migration Needed</div>
          <div>No localStorage data found to migrate.</div>
        </div>
      ) : (
        <>
          {/* Data Summary */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px', color: '#1f2937' }}>📊 Data Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              {Object.entries(localStorageData).map(([key, data]) => (
                <div key={key} style={{ 
                  backgroundColor: 'white', 
                  padding: '12px', 
                  borderRadius: '6px',
                  border: '1px solid #d1d5db'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{key}</div>
                  <div style={{ color: '#6b7280' }}>{data.count} items</div>
                </div>
              ))}
            </div>
          </div>

          {/* Migration Button */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              style={{
                backgroundColor: isMigrating ? '#9ca3af' : '#3b82f6',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: isMigrating ? 'not-allowed' : 'pointer',
                minWidth: '200px'
              }}
            >
              {isMigrating ? '🔄 Migrating...' : '🚀 Start Migration'}
            </button>
          </div>

          {/* Migration Result */}
          {migrationResult && (
            <div style={{ 
              padding: '15px', 
              borderRadius: '6px',
              backgroundColor: migrationResult.success ? '#dcfce7' : '#fef2f2',
              border: migrationResult.success ? '1px solid #16a34a' : '1px solid #dc2626'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '10px',
                color: migrationResult.success ? '#16a34a' : '#dc2626'
              }}>
                {migrationResult.success ? '✅ Migration Successful!' : '❌ Migration Failed'}
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                {migrationResult.message}
              </div>

              {migrationResult.success && (
                <div style={{ fontSize: '14px', color: '#16a34a' }}>
                  <div>✅ Migrated {migrationResult.totalItemsMigrated} items</div>
                  <div>✅ Migrated data types: {migrationResult.migratedKeys.join(', ')}</div>
                  <div>✅ localStorage has been cleared</div>
                </div>
              )}

              {migrationResult.errors.length > 0 && (
                <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '10px' }}>
                  <div>Errors encountered:</div>
                  {migrationResult.errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Warning */}
          <div style={{ 
            fontSize: '14px', 
            color: '#f59e0b',
            backgroundColor: '#fef3c7',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #f59e0b',
            marginTop: '15px'
          }}>
            ⚠️ <strong>Important:</strong> After migration, all localStorage data will be cleared and the app will use Firebase exclusively. Make sure you're signed in and have a stable internet connection.
          </div>
        </>
      )}

      {/* Refresh Button */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          onClick={analyzeLocalStorage}
          disabled={isAnalyzing}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer'
          }}
        >
          {isAnalyzing ? '🔄 Analyzing...' : '🔄 Refresh Analysis'}
        </button>
      </div>
    </div>
  );
} 