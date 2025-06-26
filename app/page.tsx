'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';

export default function Home() {
  const [idea, setIdea] = useState(
    'Click the button to get a fresh opinion.',
  );
  const [loading, setLoading] = useState(false);

  const [userOpinion, setUserOpinion] = useState('');
  const [message, setMessage] = useState('');

  const [allOpinions, setAllOpinions] = useState<string[]>([]);

  // Load opinions from localStorage with error handling
  useEffect(() => {
    try {
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that it's an array
        if (Array.isArray(parsed)) {
          setAllOpinions(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading opinions from localStorage:', error);
      // Reset to empty array if corrupted
      setAllOpinions([]);
      localStorage.removeItem('opinions');
    }
  }, []);

  // Generate random opinion from OpenAI API
  const generateOpinion = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate opinion');
      }

      const data = await response.json();
      const newOpinion = data.opinion;
      
      setIdea(newOpinion);
      
      // Add to opinions list and save to localStorage with error handling
      const updatedOpinions = [...allOpinions, newOpinion];
      setAllOpinions(updatedOpinions);
      
      try {
        localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        setMessage('Opinion generated but failed to save locally.');
      }
      
    } catch (error) {
      console.error('Error generating opinion:', error);
      setMessage('Failed to generate opinion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Submit user's own opinion
  const handleSubmitOpinion = () => {
    if (!userOpinion.trim()) {
      setMessage('Please enter an opinion before submitting.');
      return;
    }

    // Add user opinion to the list and save with error handling
    const updatedOpinions = [...allOpinions, userOpinion];
    setAllOpinions(updatedOpinions);
    
    try {
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      setMessage('Your opinion has been saved!');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      setMessage('Opinion added but failed to save locally.');
    }
    
    // Clear the input
    setUserOpinion('');
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text }))} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '800px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#333' }}>
          Opinion Generator
        </h1>

        {/* Random Opinion Generator Section */}
        <section style={{ marginBottom: '3rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#555' }}>
            🎲 Random Opinion Generator
          </h2>
          
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '6px', 
            marginBottom: '1rem',
            minHeight: '60px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <p style={{ fontSize: '1.1rem', margin: 0, fontStyle: 'italic' }}>
              {loading ? 'Generating opinion...' : idea}
            </p>
          </div>
          
          <button
            onClick={generateOpinion}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#0056b3';
            }}
            onMouseOut={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#007bff';
            }}
          >
            {loading ? 'Generating...' : 'Generate New Opinion'}
          </button>
        </section>

        {/* User Opinion Submission Section */}
        <section style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#555' }}>
            ✍️ Share Your Opinion
          </h2>
          
          <textarea
            value={userOpinion}
            onChange={(e) => setUserOpinion(e.target.value)}
            placeholder="What's your opinion on something? Share your thoughts here..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              resize: 'vertical',
              fontFamily: 'inherit',
              marginBottom: '1rem'
            }}
          />
          
          <button
            onClick={handleSubmitOpinion}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#1e7e34'}
            onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#28a745'}
          >
            Submit Opinion
          </button>
        </section>

        {/* Status Messages */}
        {message && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            borderRadius: '6px',
            backgroundColor: message.includes('Failed') ? '#f8d7da' : '#d4edda',
            color: message.includes('Failed') ? '#721c24' : '#155724',
            border: `1px solid ${message.includes('Failed') ? '#f5c6cb' : '#c3e6cb'}`
          }}>
            {message}
          </div>
        )}

        {/* Instructions */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e9ecef', 
          borderRadius: '6px', 
          fontSize: '0.9rem',
          color: '#6c757d'
        }}>
          <p style={{ margin: 0 }}>
            💡 <strong>Tip:</strong> All opinions (generated and submitted) are automatically saved 
            and appear in the sidebar. Click on any opinion in the sidebar to view it in detail.
          </p>
        </div>
      </main>
    </div>
  );
}