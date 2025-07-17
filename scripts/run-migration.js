// =============================================================================
// Quick Migration Runner
// Run this to migrate your current user's portfolio data
// =============================================================================

const { cleanupPortfolioData } = require('./clean-portfolio-data');

async function runMigration() {
  console.log('🚀 Starting portfolio migration...');
  
  try {
    await cleanupPortfolioData();
    console.log('✅ Migration completed successfully!');
    console.log('📝 Check your profile page - underscored opinions should now be clean!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 