#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Parse command line arguments first
const args = process.argv.slice(2);
const command = args[0];

// Only initialize Firebase for commands that need it
const needsFirebase = ['push-json', 'list-collections'];

let db;

if (needsFirebase.includes(command)) {
  // Initialize Firebase Admin SDK
  // Note: This requires a service account key file
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

  if (!fs.existsSync(serviceAccount)) {
    console.error('❌ Firebase service account file not found!');
    console.error('Please download your service account key from Firebase Console and save it as:');
    console.error('- ./firebase-service-account.json');
    console.error('- Or set FIREBASE_SERVICE_ACCOUNT_PATH environment variable');
    process.exit(1);
  }

  try {
    const serviceAccountKey = require(path.resolve(serviceAccount));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: `https://${serviceAccountKey.project_id}.firebaseio.com`
    });
    
    console.log('✅ Firebase Admin SDK initialized');
    db = admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Usage: node push-to-firestore.js <command> [options]

Commands:
  push-json <file>     Push JSON data from file to Firestore
  push-localStorage    Extract localStorage from browser and push to Firestore
  list-collections     List all collections in Firestore
  
Examples:
  node push-to-firestore.js push-json ./localStorage-data.json
  node push-to-firestore.js list-collections
  
Environment Variables:
  FIREBASE_SERVICE_ACCOUNT_PATH  Path to service account JSON file
  FIREBASE_PROJECT_ID           Firebase project ID (optional)
  `);
}

async function pushJsonToFirestore(filePath, collectionName = 'localStorage_backup') {
  try {
    console.log(`📖 Reading data from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Found ${Array.isArray(data) ? data.length : 1} items to upload`);
    
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    if (Array.isArray(data)) {
      // Handle array of localStorage items
      for (const item of data) {
        const docRef = db.collection(collectionName).doc();
        batch.set(docRef, {
          ...item,
          uploadedAt: timestamp,
          uploadMethod: 'script'
        });
      }
    } else {
      // Handle single object
      const docRef = db.collection(collectionName).doc();
      batch.set(docRef, {
        ...data,
        uploadedAt: timestamp,
        uploadMethod: 'script'
      });
    }
    
    console.log('🚀 Uploading to Firestore...');
    await batch.commit();
    console.log('✅ Upload completed successfully!');
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

async function listCollections() {
  try {
    console.log('📋 Listing Firestore collections...');
    const collections = await db.listCollections();
    
    console.log('Collections found:');
    for (const collection of collections) {
      console.log(`  - ${collection.id}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to list collections:', error.message);
    process.exit(1);
  }
}

function generateLocalStorageExtractionScript() {
  const script = `
// Run this in your browser console to extract localStorage data
(() => {
  const localStorageData = [];
  
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
        
        localStorageData.push({
          key,
          value,
          parsedValue,
          isJSON,
          extractedAt: new Date().toISOString()
        });
      }
    }
  }
  
  // Create download link
  const dataStr = JSON.stringify(localStorageData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'localStorage-data.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('📥 localStorage data downloaded as localStorage-data.json');
  console.log('💾 Found', localStorageData.length, 'items');
  
  return localStorageData;
})();
`;
  
  console.log('📋 Browser script to extract localStorage:');
  console.log('Copy and run this in your browser console:');
  console.log('='.repeat(60));
  console.log(script);
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 This will download a localStorage-data.json file');
  console.log('📤 Then run: npm run push-to-firestore push-json ./localStorage-data.json');
}

// Main command router
async function main() {
  switch (command) {
    case 'push-json':
      const filePath = args[1];
      if (!filePath) {
        console.error('❌ Please provide a file path');
        printUsage();
        process.exit(1);
      }
      await pushJsonToFirestore(filePath);
      break;
      
    case 'push-localStorage':
      generateLocalStorageExtractionScript();
      break;
      
    case 'list-collections':
      await listCollections();
      break;
      
    default:
      console.error('❌ Unknown command:', command);
      printUsage();
      process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 