'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DiagnosticResult {
  collection: string;
  query: string;
  results: any[];
  count: number;
  error?: string;
}

export default function FirestoreDataDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [targetUsername, setTargetUsername] = useState('Swing-Trader Sam');

  const runDiagnostic = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // 1. Check users collection for target username
      console.log('🔍 DIAGNOSTIC 1: Checking users collection');
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', targetUsername),
        limit(5)
      );
      const usersSnap = await getDocs(usersQuery);
      const usersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      results.push({
        collection: 'users',
        query: `username == "${targetUsername}"`,
        results: usersData,
        count: usersData.length
      });
      console.log('✅ Users query result:', usersData);

      // 2. Check autonomous-bots collection
      console.log('🔍 DIAGNOSTIC 2: Checking autonomous-bots collection');
      const botsSnap = await getDocs(collection(db, 'autonomous-bots'));
      const botsData: any[] = [];
      botsSnap.forEach(doc => {
        const data = doc.data();
        const botUsername = data.personality?.name || data.username || `Bot_${doc.id}`;
        if (botUsername === targetUsername || doc.id === targetUsername) {
          botsData.push({ id: doc.id, ...data, resolvedUsername: botUsername });
        }
      });
      results.push({
        collection: 'autonomous-bots',
        query: `personality.name == "${targetUsername}" OR doc.id == "${targetUsername}"`,
        results: botsData,
        count: botsData.length
      });
      console.log('✅ Bots query result:', botsData);

      // 3. Get the resolved user ID from either collection
      const resolvedUser = usersData[0] || botsData[0] || null;
      const resolvedUserId = (resolvedUser as any)?.uid || (resolvedUser as any)?.id;
      
      console.log('🔍 RESOLVED USER:', { resolvedUser, resolvedUserId });

      if (resolvedUserId) {
        // 4. Check activity-feed for this userId
        console.log('🔍 DIAGNOSTIC 3: Checking activity-feed');
        const activityQuery = query(
          collection(db, 'activity-feed'),
          where('userId', '==', resolvedUserId),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const activitySnap = await getDocs(activityQuery);
        const activityData = activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        results.push({
          collection: 'activity-feed',
          query: `userId == "${resolvedUserId}"`,
          results: activityData,
          count: activityData.length
        });
        console.log('✅ Activity query result:', activityData);

        // 5. Check transactions for this userId
        console.log('🔍 DIAGNOSTIC 4: Checking transactions');
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', resolvedUserId),
          limit(10)
        );
        const transactionsSnap = await getDocs(transactionsQuery);
        const transactionsData = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        results.push({
          collection: 'transactions',
          query: `userId == "${resolvedUserId}"`,
          results: transactionsData,
          count: transactionsData.length
        });
        console.log('✅ Transactions query result:', transactionsData);

        // 6. Check user-portfolios document
        console.log('🔍 DIAGNOSTIC 5: Checking user-portfolios');
        const portfolioDoc = await getDoc(doc(db, 'user-portfolios', resolvedUserId));
        const portfolioData = portfolioDoc.exists() ? [{ id: portfolioDoc.id, ...portfolioDoc.data() }] : [];
        results.push({
          collection: 'user-portfolios',
          query: `doc("${resolvedUserId}")`,
          results: portfolioData,
          count: portfolioData.length
        });
        console.log('✅ Portfolio query result:', portfolioData);

        // 7. Check for activities with username "HotFalcon_878"
        console.log('🔍 DIAGNOSTIC 6: Checking for HotFalcon_878 activities');
        const hotFalconQuery = query(
          collection(db, 'activity-feed'),
          where('username', '==', 'HotFalcon_878'),
          limit(10)
        );
        const hotFalconSnap = await getDocs(hotFalconQuery);
        const hotFalconData = hotFalconSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        results.push({
          collection: 'activity-feed (HotFalcon_878)',
          query: `username == "HotFalcon_878"`,
          results: hotFalconData,
          count: hotFalconData.length
        });
        console.log('✅ HotFalcon_878 query result:', hotFalconData);

        // 8. Cross-reference analysis
        console.log('🔍 DIAGNOSTIC 7: Cross-reference analysis');
        if (hotFalconData.length > 0 && activityData.length === 0) {
          console.error('❌ INCONSISTENCY DETECTED: HotFalcon_878 activities exist but no activities for resolved userId');
          console.error('❌ This suggests activities are attributed to wrong userId or username mismatch');
        }

        if (transactionsData.length > 0 && portfolioData.length === 0) {
          console.warn('⚠️ POTENTIAL ISSUE: Transactions exist but no portfolio document');
        }
      }

    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      results.push({
        collection: 'ERROR',
        query: 'diagnostic_error',
        results: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  return (
    <div style={{
      background: '#f8f9fa',
      padding: '20px',
      margin: '20px 0',
      borderRadius: '8px',
      border: '2px solid #dee2e6'
    }}>
      <h3 style={{ marginTop: 0, color: '#495057' }}>🔍 Firestore Data Diagnostic</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Target Username:
        </label>
        <input
          type="text"
          value={targetUsername}
          onChange={(e) => setTargetUsername(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ced4da',
            marginRight: '12px',
            minWidth: '200px'
          }}
        />
        <button
          onClick={runDiagnostic}
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            backgroundColor: isRunning ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running...' : 'Run Diagnostic'}
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div>
          <h4>Results:</h4>
          {diagnostics.map((result, index) => (
            <div key={index} style={{
              background: 'white',
              padding: '12px',
              marginBottom: '12px',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <h5 style={{ margin: '0 0 8px 0', color: result.error ? '#dc3545' : '#495057' }}>
                📁 {result.collection} ({result.count} results)
              </h5>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6c757d' }}>
                Query: {result.query}
              </p>
              {result.error && (
                <p style={{ color: '#dc3545', margin: '0 0 8px 0' }}>
                  Error: {result.error}
                </p>
              )}
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '14px' }}>
                  View {result.count} results
                </summary>
                <pre style={{
                  background: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '4px',
                  marginTop: '8px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '300px'
                }}>
                  {JSON.stringify(result.results, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 