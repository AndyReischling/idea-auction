'use client';

import React from 'react';
import FirebaseMigrationUI from '../components/FirebaseMigrationUI';
import { useAuth } from '../lib/auth-context';

export default function MigrationPage() {
  const { user } = useAuth();

  return (
    <div className="migration-page" style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f3f4f6',
      paddingTop: '40px',
      paddingBottom: '40px'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px' }}>
            📦 → ☁️ Data Migration
          </h1>
          <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '600px', margin: '0 auto' }}>
            Migrate your localStorage data to Firebase for persistent, secure, and cross-device storage.
          </p>
        </div>

        {!user ? (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '40px', 
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔐</div>
            <h2 style={{ fontSize: '24px', color: '#1f2937', marginBottom: '15px' }}>
              Sign In Required
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '25px' }}>
              Please sign in to access the migration tool and secure your data.
            </p>
            <button
              onClick={() => window.location.href = '/auth'}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <FirebaseMigrationUI onComplete={() => {
            // Optionally redirect or show success message
            setTimeout(() => {
              window.location.href = '/profile';
            }, 3000);
          }} />
        )}

        {/* Migration Benefits */}
        <div style={{ marginTop: '60px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: '30px' }}>
            🌟 Benefits of Firebase Migration
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '20px',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '15px' }}>💾</div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
                Persistent Storage
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Your data persists across browser sessions and device changes
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '15px' }}>🔒</div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
                Secure Storage
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Firebase provides enterprise-grade security and data protection
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '20px', 
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '15px' }}>🌐</div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '10px' }}>
                Cross-Device Sync
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Access your data from any device, anywhere in the world
              </p>
            </div>
          </div>
        </div>

        {/* What Gets Migrated */}
        <div style={{ marginTop: '50px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: '30px' }}>
            📋 What Gets Migrated
          </h2>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '8px',
            maxWidth: '800px',
            margin: '0 auto',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              fontSize: '14px'
            }}>
              {[
                '👤 User Profile & Balance',
                '💡 Your Opinions',
                '💰 Transaction History',
                '🤖 Bot Configurations',
                '📊 Portfolio Snapshots',
                '🎯 Advanced Bets',
                '📈 Short Positions',
                '🔄 Activity Feeds',
                '🏪 Market Data',
                '⚙️ App Settings'
              ].map((item, index) => (
                <div key={index} style={{ 
                  padding: '8px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 