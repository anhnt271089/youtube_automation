import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

async function cleanupDriveFolders() {
  console.log('🧹 Starting Drive Folder Cleanup Tool...\n');
  
  try {
    const sheetsService = new GoogleSheetsService();
    
    // Run the cleanup process
    const result = await sheetsService.cleanupDuplicateDriveFolders();
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   • Groups processed: ${result.processedCount}`);
    console.log(`   • Duplicate folders cleaned: ${result.cleanedCount}`);
    
    if (result.cleanedCount === 0) {
      console.log('\n🎉 No cleanup needed - your Drive folders are already optimized!');
    } else {
      console.log(`\n🎉 Successfully cleaned up ${result.cleanedCount} duplicate folders!`);
      console.log('   📝 Master sheet URLs have been updated to point to the correct folders');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    logger.error('Drive folder cleanup error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDriveFolders().catch(console.error);
}

export default cleanupDriveFolders;