// app/firestore-import/page.tsx
'use client';

import MigrationUI from '../components/MigrationUI';

/**
 * Firestore-Import
 * --------------------------------------------------------------
 * A minimal wrapper that renders the 🔌 MigrationUI component.
 * The UI takes care of extracting any *remaining* browser data
 * **once** and writing it into Firestore. After that first run
 * nothing touches `localStorage` again.
 */
export default function FirestoreImportPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8 flex items-start justify-center">
      <MigrationUI />
    </div>
  );
}
