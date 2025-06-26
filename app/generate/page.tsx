'use client';

import { useState } from 'react';

export default function GenerateOpinions() {
  const [opinion, setOpinion] = useState('Click the button to generate an opinion!');
  const [userInput, setUserInput] = useState('');

  const generateMockOpinion = () => {
    const mockOpinions = [
      "I think pineapple on pizza is actually a great combination of sweet and savory.",
      "Morning people are just evening people who gave up on their dreams.",
      "Social media has made us more connected but less social.",
      "The best ideas come when you're not trying to think of them.",
      "Coffee is just bean soup for adults who can't handle vegetables."
    ];
    
    const randomOpinion = mockOpinions[Math.floor(Math.random() * mockOpinions.length)];
    setOpinion(randomOpinion);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header with Back Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Opinion Generator</h1>
        <a
          href="/"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}
        >
          ← Back to Profile
        </a>
      </div>

      {/* Opinion Generator */}
      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        marginBottom: '2rem' 
      }}>
        <h2>🎲 Random Opinion Generator</h2>
        
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px', 
          marginBottom: '1rem',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <p style={{ margin: 0, fontStyle: 'italic' }}>{opinion}</p>
        </div>
        
        <button
          onClick={generateMockOpinion}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Generate New Opinion
        </button>
      </div>

      {/* Submit Opinion */}
      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #ddd', 
        borderRadius: '8px' 
      }}>
        <h2>✍️ Submit Your Opinion</h2>
        
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Share your thoughts..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '0.75rem',
            border: '1px solid #ccc',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontFamily: 'inherit'
          }}
        />
        
        <button
          onClick={() => {
            if (userInput.trim()) {
              alert(`Opinion submitted: "${userInput}"`);
              setUserInput('');
            }
          }}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Submit Opinion
        </button>
      </div>
    </div>
  );
}