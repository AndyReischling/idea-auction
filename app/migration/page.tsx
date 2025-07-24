// 🔄 Legacy LocalStorage Sync Page → Firestore Import
// -----------------------------------------------------------------------------
// This page used to render the <LocalStorageSync /> component that migrated
// browser‑only data into the app. That logic now lives in Firestore‑native
// helpers + UI. We simply mount the new <BrowserImport /> component here so
// the old route continues to work (and can be removed once every user has
// migrated).

'use client';

import MigrationUI from '../components/MigrationUI';      // <- default export

export default function FirestoreImportPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <MigrationUI />
    </div>
  );
}
