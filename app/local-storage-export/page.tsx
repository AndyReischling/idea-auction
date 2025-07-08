'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';

interface LocalStorageItem {
  key: string;
  value: string;
  parsedValue?: any;
  isJSON: boolean;
}

export default function LocalStorageExportPage() {
  const [localStorageData, setLocalStorageData] = useState<LocalStorageItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    // Extract all localStorage data
    const items: LocalStorageItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          let parsedValue;
          let isJSON = false;
          
          try {
            parsedValue = JSON.parse(value);
            isJSON = true;
          } catch {
            parsedValue = value;
            isJSON = false;
          }
          
          items.push({
            key,
            value,
            parsedValue,
            isJSON
          });
        }
      }
    }
    
    setLocalStorageData(items);
  }, []);

  const toggleSelection = (key: string) => {
    setSelectedItems(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedItems(localStorageData.map(item => item.key));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const uploadToFirestore = async () => {
    if (!user) {
      setUploadResults(prev => [...prev, '❌ Please sign in to upload data']);
      return;
    }

    setUploading(true);
    setUploadResults([]);

    try {
      for (const key of selectedItems) {
        const item = localStorageData.find(i => i.key === key);
        if (!item) continue;

        try {
          // Create a document in a 'localStorage_backup' collection
          const backupData = {
            userId: user.uid,
            userEmail: user.email,
            key: item.key,
            value: item.value,
            parsedValue: item.isJSON ? item.parsedValue : item.value,
            isJSON: item.isJSON,
            exportedAt: new Date().toISOString(),
            originalTimestamp: Date.now()
          };

          await addDoc(collection(db, 'localStorage_backup'), backupData);
          
          setUploadResults(prev => [...prev, `✅ Uploaded: ${key}`]);
        } catch (error) {
          setUploadResults(prev => [...prev, `❌ Failed to upload ${key}: ${error}`]);
        }
      }

      setUploadResults(prev => [...prev, '🎉 Upload completed!']);
    } catch (error) {
      setUploadResults(prev => [...prev, `❌ Upload failed: ${error}`]);
    } finally {
      setUploading(false);
    }
  };

  const generateCurlCommand = () => {
    if (selectedItems.length === 0) return '';

    const selectedData = selectedItems.map(key => {
      const item = localStorageData.find(i => i.key === key);
      return item ? {
        key: item.key,
        value: item.value,
        parsedValue: item.isJSON ? item.parsedValue : item.value,
        isJSON: item.isJSON
      } : null;
    }).filter(Boolean);

    // Note: This is a simplified curl example - actual Firestore REST API requires proper authentication
    const curlCommand = `curl -X POST \\
  'https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/localStorage_backup' \\
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "fields": {
      "userId": {"stringValue": "${user?.uid}"},
      "userEmail": {"stringValue": "${user?.email}"},
      "data": {"arrayValue": {"values": ${JSON.stringify(selectedData, null, 2).replace(/"/g, '\\"')}}}
    }
  }'`;

    return curlCommand;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Local Storage → Firestore</h1>
          
          {!user && (
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-6">
              <p className="text-yellow-800">Please sign in to upload data to Firestore.</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Local Storage Data ({localStorageData.length} items)</h2>
            
            <div className="mb-4 space-x-4">
              <button
                onClick={selectAll}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Clear Selection
              </button>
              <button
                onClick={uploadToFirestore}
                disabled={uploading || selectedItems.length === 0 || !user}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : `Upload ${selectedItems.length} items`}
              </button>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {localStorageData.map((item, index) => (
                <div key={index} className="p-4 border-b last:border-b-0">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.key)}
                      onChange={() => toggleSelection(item.key)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-mono font-semibold text-blue-600">{item.key}</span>
                        {item.isJSON && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">JSON</span>
                        )}
                      </div>
                      <div className="bg-gray-100 rounded p-2 text-sm font-mono overflow-x-auto">
                        {item.isJSON ? (
                          <pre>{JSON.stringify(item.parsedValue, null, 2)}</pre>
                        ) : (
                          <div>{item.value}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {uploadResults.length > 0 && (
            <div className="mb-6 bg-gray-100 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Upload Results</h3>
              <div className="space-y-1 font-mono text-sm">
                {uploadResults.map((result, index) => (
                  <div key={index} className={
                    result.includes('✅') ? 'text-green-700' :
                    result.includes('❌') ? 'text-red-700' :
                    'text-gray-700'
                  }>
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Equivalent cURL Command</h3>
              <p className="text-blue-700 text-sm mb-2">
                This is a simplified example. Actual Firestore REST API requires proper authentication.
              </p>
              <pre className="bg-gray-800 text-green-400 p-4 rounded text-xs overflow-x-auto">
{generateCurlCommand()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 