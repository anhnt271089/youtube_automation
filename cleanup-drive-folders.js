import GoogleDriveService from './src/services/googleDriveService.js';

async function cleanupDriveFolders() {
  try {
    const googleDriveService = new GoogleDriveService();
    
    console.log('🧹 Starting Google Drive cleanup...');
    console.log('Videos root folder ID: 1MJGPWS57rPDWWaeRU-hm7C-EeCTSiN_Y');
    
    // Get all contents in the videos folder
    const contents = await googleDriveService.getFolderContents('1MJGPWS57rPDWWaeRU-hm7C-EeCTSiN_Y');
    
    if (contents.length === 0) {
      console.log('✅ Videos folder is already empty');
      return;
    }
    
    console.log(`\nFound ${contents.length} items to delete:`);
    contents.forEach((item, index) => {
      const type = item.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
      console.log(`${index + 1}. ${type} ${item.name} (ID: ${item.id})`);
    });
    
    console.log('\n🗑️ Deleting items...');
    
    // Delete all items
    for (const item of contents) {
      try {
        await googleDriveService.drive.files.delete({
          fileId: item.id
        });
        
        const type = item.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄';
        console.log(`✅ Deleted ${type} ${item.name}`);
      } catch (deleteError) {
        console.error(`❌ Failed to delete ${item.name}:`, deleteError.message);
      }
    }
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const remainingContents = await googleDriveService.getFolderContents('1MJGPWS57rPDWWaeRU-hm7C-EeCTSiN_Y');
    
    if (remainingContents.length === 0) {
      console.log('✅ Cleanup successful - videos folder is now empty');
    } else {
      console.log(`⚠️ Cleanup incomplete - ${remainingContents.length} items remain:`);
      remainingContents.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (ID: ${item.id})`);
      });
    }
    
    return remainingContents.length === 0;
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    if (error.code) console.error('Error code:', error.code);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDriveFolders().catch(console.error);
}

export default cleanupDriveFolders;