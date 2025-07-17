// =============================================================================
// Portfolio Data Cleanup Script
// Fixes underscored opinion entries in user portfolios
// =============================================================================

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'your-project-id'
});

const db = admin.firestore();

// Sanitize function (same as in the frontend)
const sanitizeFieldName = (text) => {
  return text.replace(/[.#$[\]]/g, '_').replace(/\s+/g, '_').slice(0, 100);
};

// Get all opinion texts from opinions collection
async function getAllOpinions() {
  const opinionsSnap = await db.collection('opinions').get();
  const opinions = new Map();
  
  opinionsSnap.forEach(doc => {
    const data = doc.data();
    if (data.text) {
      const sanitized = sanitizeFieldName(data.text);
      opinions.set(sanitized, data.text);
    }
  });
  
  return opinions;
}

// Clean up a single user's portfolio
async function cleanUserPortfolio(userId, userDoc, opinionMap) {
  const portfolio = userDoc.portfolio || {};
  const newPortfolio = {};
  let hasChanges = false;
  
  console.log(`\n🔍 Cleaning portfolio for user: ${userDoc.username || userId}`);
  console.log(`📊 Current portfolio keys: ${Object.keys(portfolio).length}`);
  
  // Group entries by original opinion text
  const consolidatedPortfolio = {};
  
  for (const [key, quantity] of Object.entries(portfolio)) {
    let originalText = key;
    
    // If the key contains underscores, try to find the original text
    if (key.includes('_')) {
      const foundOriginal = opinionMap.get(key);
      if (foundOriginal) {
        originalText = foundOriginal;
        console.log(`📝 Converting: "${key}" → "${originalText}"`);
        hasChanges = true;
      }
    }
    
    // Consolidate quantities for the same opinion
    if (consolidatedPortfolio[originalText]) {
      consolidatedPortfolio[originalText] += (typeof quantity === 'number' ? quantity : 1);
    } else {
      consolidatedPortfolio[originalText] = (typeof quantity === 'number' ? quantity : 1);
    }
  }
  
  // Convert back to sanitized keys for storage (but properly deduplicated)
  for (const [originalText, quantity] of Object.entries(consolidatedPortfolio)) {
    const sanitizedKey = sanitizeFieldName(originalText);
    newPortfolio[sanitizedKey] = quantity;
  }
  
  console.log(`📊 New portfolio keys: ${Object.keys(newPortfolio).length}`);
  
  // Update the user document if changes were made
  if (hasChanges || Object.keys(newPortfolio).length !== Object.keys(portfolio).length) {
    await db.collection('users').doc(userId).update({
      portfolio: newPortfolio,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      portfolioCleanedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Updated portfolio for ${userDoc.username || userId}`);
    return true;
  }
  
  console.log(`✨ No changes needed for ${userDoc.username || userId}`);
  return false;
}

// Main cleanup function
async function cleanupPortfolioData() {
  console.log('🚀 Starting portfolio cleanup...');
  
  try {
    // Get all opinions for mapping
    console.log('📚 Loading all opinions...');
    const opinionMap = await getAllOpinions();
    console.log(`📚 Loaded ${opinionMap.size} opinion mappings`);
    
    // Get all users
    console.log('👥 Loading all users...');
    const usersSnap = await db.collection('users').get();
    console.log(`👥 Found ${usersSnap.size} users`);
    
    let updatedCount = 0;
    let totalUsers = 0;
    
    // Process each user
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      if (userData.portfolio && Object.keys(userData.portfolio).length > 0) {
        totalUsers++;
        const wasUpdated = await cleanUserPortfolio(userId, userData, opinionMap);
        if (wasUpdated) {
          updatedCount++;
        }
      }
    }
    
    console.log('\n🎉 Cleanup completed!');
    console.log(`📊 Total users processed: ${totalUsers}`);
    console.log(`🔄 Users updated: ${updatedCount}`);
    console.log(`✨ Users unchanged: ${totalUsers - updatedCount}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupPortfolioData()
    .then(() => {
      console.log('🏁 Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupPortfolioData, sanitizeFieldName }; 