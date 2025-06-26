'use client';

import Link from 'next/link';

type OpinionItem = { id: string; text: string } | string;

export default function Sidebar({
  opinions = [],          // ← default to empty array
}: {
  opinions?: OpinionItem[];   // ← allow it to be left out / undefined
}) {
  return (
    <aside
      style={{
        width: 240,
        height: '100vh',
        overflowY: 'auto',
        padding: '1rem',
        background: '#f8f8f8',
        borderRight: '1px solid #e1e1e1',
        flexShrink: 0,
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📈 Take Stocks</h2>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {opinions
          ?.filter(Boolean)                       // skip empty slots
          .map((op, i) => {
            const text = typeof op === 'string' ? op : op.text;
            const id   = typeof op === 'string' ? `${i}` : op.id;
            return (
              <li key={id} style={{ marginBottom: '.75rem' }}>
                <Link
                  href={`/opinion/${id}`}
                  style={{ fontSize: '.85rem', color: '#333', textDecoration: 'none' }}
                >
                  {text.slice(0, 60)}
                </Link>
              </li>
            );
          })}
      </ul>
    </aside>
  );
}

