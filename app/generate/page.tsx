'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';

function GenerateOpinions() {
  const [opinion, setOpinion] = useState('Click the button to generate an opinion!');
  const [userInput, setUserInput] = useState('');
  const [allOpinions, setAllOpinions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('opinions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validOpinions = parsed.filter(op => op && typeof op === 'string' && op.trim().length > 0);
          setAllOpinions(validOpinions);
        }
      }
    } catch (error) {
      console.error('Error loading opinions:', error);
      setAllOpinions([]);
    }
  }, []);

  const generateOpinion = async () => {
    setLoading(true);
    
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
      
      setOpinion(newOpinion);
      
      const updatedOpinions = [...allOpinions, newOpinion];
      setAllOpinions(updatedOpinions);
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      
    } catch (error) {
      console.error('Error generating opinion:', error);
      
      const mockOpinions = [
        "I'm against picketing, but I don't know how to show it.",
        "I like vending machines 'cause snacks are better when they fall. If I buy a candy bar at a store, oftentimes, I will drop it... So that it achieves its maximum flavor potential",
        "All right, now that the popsicle's melted we've got ourselves a tongue depressor.",
        "Say no more. If it's giving people meat, then I'm on board. I've always said Humans need more animal blood. It keeps the spine straight..",
        "Is Wario A Libertarian.",
        "see this watch? i got it by Crying. my car? crying. my beautiful wife? Crying. My perfect teeth? Crying.",
        "oh nothin, i was just buying some ear medication for my sick uncle...who's a Model by the way",
        "I went to buy some camouflage pants the other day but couldn't find any."
      ];
      
      const randomOpinion = mockOpinions[Math.floor(Math.random() * mockOpinions.length)];
      setOpinion(randomOpinion);
      
      const updatedOpinions = [...allOpinions, randomOpinion];
      setAllOpinions(updatedOpinions);
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
    } finally {
      setLoading(false);
    }
  };

  const submitUserOpinion = () => {
    if (userInput.trim()) {
      const trimmedInput = userInput.trim();
      
      const updatedOpinions = [...allOpinions, trimmedInput];
      setAllOpinions(updatedOpinions);
      localStorage.setItem('opinions', JSON.stringify(updatedOpinions));
      
      setUserInput('');
      setOpinion(`Submitted: ${trimmedInput}`);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar opinions={allOpinions.map((text, i) => ({ id: i.toString(), text: text || '' }))} />
      
      <main style={{ padding: '2rem', flex: 1, maxWidth: '800px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>Opinion Generator</h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#666' }}>
              Create and save opinions
            </p>
          </div>
          
          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href="/users"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6f42c1',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📊 View Traders
            </a>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ← Back to Profile
            </a>
          </div>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          marginBottom: '2rem' 
        }}>
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
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: '1.1rem' }}>
              {loading ? 'Generating witty opinion...' : opinion}
            </p>
          </div>
          
          <button
            onClick={generateOpinion}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Generating...' : 'Generate New Opinion'}
          </button>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#555' }}>
            ✍️ Submit Your Opinion
          </h2>
          
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="What's your opinion on something? Share your thoughts here..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontFamily: 'inherit',
              fontSize: '1rem',
              resize: 'vertical'
            }}
          />
          
          <button
            onClick={submitUserOpinion}
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

        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e9ecef', 
          borderRadius: '6px', 
          fontSize: '0.9rem',
          color: '#6c757d'
        }}>
          <p style={{ margin: 0 }}>
            💡 <strong>Tip:</strong> All opinions are automatically saved 
            and appear in the sidebar. Click on any opinion in the sidebar to view it in detail.
          </p>
        </div>
      </main>
    </div>
  );
}

export default GenerateOpinions;