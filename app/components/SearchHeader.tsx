'use client';

import SemanticSearch from './SemanticSearch';
import AuthButton from './AuthButton';
import AuthStatusIndicator from './AuthStatusIndicator';

export default function SearchHeader() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      marginBottom: '20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1 style={{
            color: 'white',
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
          }}>
            🔍 Explore the Platform
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <AuthStatusIndicator />
            <AuthButton />
          </div>
        </div>
        <SemanticSearch />
      </div>
    </div>
  );
}