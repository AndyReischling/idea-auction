'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  text: string;
  type: 'opinion' | 'user' | 'activity' | 'transaction';
  similarity: number;
  score: number;
  metadata: any;
  url: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  indexSize: number;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexSize, setIndexSize] = useState(0);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close results when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=${selectedType}&limit=8`
      );
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data: SearchResponse = await response.json();
      setResults(data.results || []);
      setIndexSize(data.indexSize || 0);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setShowResults(true); // Show empty state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.length > 2) {
        handleSearch(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [query, selectedType]);

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setQuery('');
    router.push(result.url);
  };

  const handleReindex = async () => {
    setIsIndexing(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reindex' }),
      });
      
      if (response.ok) {
        alert('✅ Search index updated successfully!');
        // Refresh the index size display
        if (query.length > 2) {
          handleSearch(query);
        }
      } else {
        alert('❌ Failed to update search index');
      }
    } catch (error) {
      console.error('Reindex error:', error);
      alert('❌ Failed to update search index');
    } finally {
      setIsIndexing(false);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'opinion': return '💭';
      case 'user': return '👤';
      case 'activity': return '📊';
      case 'transaction': return '💰';
      default: return '🔍';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'opinion': return '#8b5cf6';
      case 'user': return '#10b981';
      case 'activity': return '#f59e0b';
      case 'transaction': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div ref={searchRef} style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'white',
        border: '2px solid #e2e8f0',
        borderRadius: '12px',
        padding: '4px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search opinions, users, or activities..."
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            outline: 'none',
            background: 'transparent',
          }}
        />
        
        <select 
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            background: '#f8fafc',
            fontSize: '14px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all">All ({indexSize})</option>
          <option value="opinion">Opinions</option>
          <option value="user">Users</option>
          <option value="activity">Activity</option>
          <option value="transaction">Transactions</option>
        </select>

        <button
          onClick={handleReindex}
          disabled={isIndexing}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '8px',
            background: isIndexing ? '#d1d5db' : '#6366f1',
            color: 'white',
            fontSize: '14px',
            cursor: isIndexing ? 'not-allowed' : 'pointer',
            fontWeight: '600',
          }}
          title="Update search index with latest content"
        >
          {isIndexing ? '⏳' : '🔄'}
        </button>
      </div>

      {showResults && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '2px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}>
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
              🔍 Searching...
            </div>
          ) : results.length > 0 ? (
            <div>
              {results.map((result) => (
                <div 
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  style={{
                    display: 'flex',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ marginRight: '12px', fontSize: '20px' }}>
                    {getResultIcon(result.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#1e293b',
                      marginBottom: '4px',
                      lineHeight: '1.4',
                    }}>
                      {result.text.slice(0, 120)}
                      {result.text.length > 120 && '...'}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '12px',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        textTransform: 'capitalize',
                        background: getTypeColor(result.type),
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '600',
                      }}>
                        {result.type}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {result.score}% match
                      </span>
                      {result.metadata.amount && (
                        <span style={{ color: '#64748b' }}>
                          ${result.metadata.amount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#64748b',
            }}>
              {indexSize === 0 ? (
                <div>
                  <p>📚 No search index found</p>
                  <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    Click the 🔄 button to build the search index
                  </p>
                </div>
              ) : (
                <p>No results found for "{query}"</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}