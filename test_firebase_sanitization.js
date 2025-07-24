
// Test Firebase data sanitization
console.log('🧪 Testing Firebase data sanitization fixes...');

if (typeof window !== 'undefined') {
  // Test bot system sanitization
  if (typeof testFirebaseDataSanitization === 'function') {
    console.log('🤖 Testing bot system sanitization...');
    testFirebaseDataSanitization();
  }
  
  // Test market data sync sanitization
  if (typeof testMarketDataSyncSanitization === 'function') {
    console.log('📊 Testing market data sync sanitization...');
    testMarketDataSyncSanitization();
  }
  
  // Test with forced bot activity
  if (typeof forceBotActivity === 'function') {
    console.log('🔄 Testing with forced bot activity...');
    forceBotActivity(3);
  }
  
  // Sync existing data
  if (typeof syncBotTransactionsToGlobalFeed === 'function') {
    console.log('🔄 Syncing existing bot transactions...');
    syncBotTransactionsToGlobalFeed();
  }
}

console.log('✅ Firebase sanitization tests queued!');

