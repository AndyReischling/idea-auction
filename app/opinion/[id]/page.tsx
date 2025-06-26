// app/opinion/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

export default function OpinionPage() {
  /* -------- routing -------- */
  const { id } = useParams<{ id: string }>();   // “id” from /opinion/[id]
  const router  = useRouter();

  /* -------- state -------- */
  const [opinions, setOpinions] = useState<{ id: string; text: string }[]>([]);
  const [opinion,  setOpinion]  = useState<string>('Loading…');

  /* -------- load from localStorage -------- */
  useEffect(() => {
    const stored = localStorage.getItem('opinions');
    if (!stored) {
      setOpinion('No opinions stored yet.');
      return;
    }

    const arr: string[] = JSON.parse(stored);               // ["op 1", "op 2", …]
    // Build the list for the sidebar
    setOpinions(
      arr.map((text, i) => ({ id: i.toString(), text }))
    );

    // Pick the single opinion for this page
    const idx = Number(id);
    if (Number.isNaN(idx) || !arr[idx]) {
      setOpinion('Opinion not found.');
    } else {
      setOpinion(arr[idx]);
    }
  }, [id]);

  /* -------- render -------- */
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* ---- sidebar ---- */}
      <Sidebar opinions={opinions} />

      {/* ---- main area ---- */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            marginBottom: '2rem',
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: '#f0f0f0'
          }}
        >
          ← Back
        </button>

        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>💬 Opinion</h2>

        <blockquote
          style={{
            fontStyle: 'italic',
            fontSize: '1.25rem',
            padding: '1.5rem',
            background: '#f7f7f7',
            borderRadius: 8,
            lineHeight: 1.4
          }}
        >
          {opinion}
        </blockquote>
      </main>
    </div>
  );
}
