import GoogleDriveService from './src/services/googleDriveService.js';

async function checkVideoStatus() {
  try {
    const googleDriveService = new GoogleDriveService();
    
    console.log('🔍 Checking current video status in master sheet...');
    console.log('Master sheet ID: 1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w');
    
    // Get all data from the master sheet
    const data = await googleDriveService.getSpreadsheetData(
      '1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w',
      'A:Z'
    );
    
    if (!data || data.length === 0) {
      console.log('❌ No data found in master sheet');
      return null;
    }
    
    // Get headers from first row
    const headers = data[0];
    
    // Find relevant column indices
    const videoIdIndex = headers.findIndex(h => h.toLowerCase().includes('id'));
    const titleIndex = headers.findIndex(h => h.toLowerCase().includes('title'));
    const urlIndex = headers.findIndex(h => h.toLowerCase().includes('url'));
    const statusIndex = headers.findIndex(h => h.toLowerCase().includes('status'));
    const driveIndex = headers.findIndex(h => h.toLowerCase().includes('drive'));
    const workbookIndex = headers.findIndex(h => h.toLowerCase().includes('workbook'));
    
    // Process data rows (skip header row)
    const dataRows = data.slice(1);
    console.log(`\n📊 Total videos in sheet: ${dataRows.length}`);
    
    // Show all videos with their current status
    console.log(`\n🎬 Current video status:\n`);
    
    dataRows.forEach((row, index) => {
      const videoId = row[videoIdIndex] || '';
      const title = row[titleIndex] || 'No title';
      const url = row[urlIndex] || '';
      const status = row[statusIndex] || 'Empty';
      const driveFolder = row[driveIndex] || '';
      const workbook = row[workbookIndex] || '';
      
      console.log(`${index + 1}. ${videoId} - ${title}`);
      console.log(`   Status: ${status}`);
      console.log(`   URL: ${url}`);
      if (driveFolder) console.log(`   Drive Folder: ${driveFolder}`);
      if (workbook) console.log(`   Workbook: ${workbook}`);
      console.log('');
    });
    
    // Look for the test video specifically
    const testVideo = dataRows.find(row => {
      const url = row[urlIndex] || '';
      return url.includes('HeuABY9f8Qo');
    });
    
    if (testVideo) {
      console.log(`\n🎯 Test video found:`);
      console.log(`   Video ID: ${testVideo[videoIdIndex]}`);
      console.log(`   Title: ${testVideo[titleIndex]}`);
      console.log(`   Status: ${testVideo[statusIndex]}`);
      console.log(`   Drive Folder: ${testVideo[driveIndex]}`);
      console.log(`   Workbook: ${testVideo[workbookIndex]}`);
    } else {
      console.log(`\n❌ Test video not found in sheet`);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error checking video status:', error.message);
    if (error.code) console.error('Error code:', error.code);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkVideoStatus().catch(console.error);
}

export default checkVideoStatus;