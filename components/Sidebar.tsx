'use client';

import Link from 'next/link';

export default function Sidebar({
  opinions,
}: {
  opinions: { id: string; text: string }[];
}) {
  return (
    <aside
      style={{
        width: '250px',
        height: '100vh',
        overflowY: 'auto',
        padding: '1rem',
        backgroundColor: '#f4f4f4',
        borderRight: '1px solid #ccc',
        position: 'fixed',
        left: 0,
        top: 0,
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📈 Take Stocks</h2>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {opinions.map((op) => (
          <li key={op.id} style={{ marginBottom: '0.75rem' }}>
            <Link
              href={`/opinion/${op.id}`}
              style={{
                fontSize: '0.85rem',
                color: '#333',
                textDecoration: 'none',
              }}
            >
              {op.text.slice(0, 50)}…
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}