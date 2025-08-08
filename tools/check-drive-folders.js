import GoogleDriveService from './src/services/googleDriveService.js';

async function checkDriveFolders() {
  try {
    const googleDriveService = new GoogleDriveService();
    
    console.log('🔍 Checking Google Drive videos folder structure...');
    console.log('Videos root folder ID: 1MJGPWS57rPDWWaeRU-hm7C-EeCTSiN_Y');
    
    // Use getFolderContents method to list items in the videos root folder
    const contents = await googleDriveService.getFolderContents('1MJGPWS57rPDWWaeRU-hm7C-EeCTSiN_Y');
    
    // Filter for folders only
    const folders = contents.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
    
    console.log(`\nFound ${folders.length} video folders:`);
    folders.forEach((folder, index) => {
      console.log(`${index + 1}. ${folder.name} (ID: ${folder.id}) - Created: ${folder.createdTime}`);
    });
    
    // Also show other files if any
    const files = contents.filter(item => item.mimeType !== 'application/vnd.google-apps.folder');
    if (files.length > 0) {
      console.log(`\n📄 Other files found: ${files.length}`);
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (Type: ${file.mimeType})`);
      });
    }
    
    if (folders.length === 0 && files.length === 0) {
      console.log('✅ Videos folder is completely empty - ready for testing');
    } else {
      console.log(`\n📋 Items to clean up: ${contents.length} total (${folders.length} folders, ${files.length} files)`);
    }
    
    return { folders, files, contents };
    
  } catch (error) {
    console.error('❌ Error checking Google Drive:', error.message);
    if (error.code) console.error('Error code:', error.code);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDriveFolders().catch(console.error);
}

export default checkDriveFolders;