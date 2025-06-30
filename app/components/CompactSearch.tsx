'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompactSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await response.json();
      setResults(data.results || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="🔍 Quick search..."
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          fontSize: '14px',
        }}
      />
      
      {showResults && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}>
          {isLoading ? (
            <div style={{ padding: '12px', textAlign: 'center' }}>Searching...</div>
          ) : results.length > 0 ? (
            results.map((result: any) => (
              <div
                key={result.id}
                onClick={() => router.push(result.url)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '12px',
                }}
              >
                {result.text.slice(0, 60)}...
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}