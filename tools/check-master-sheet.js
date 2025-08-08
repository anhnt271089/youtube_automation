import GoogleDriveService from './src/services/googleDriveService.js';

async function checkMasterSheet() {
  try {
    const googleDriveService = new GoogleDriveService();
    
    console.log('📊 Checking master sheet for videos with "New" status...');
    console.log('Master sheet ID: 1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w');
    
    // Try different range formats to get all data
    let data;
    try {
      data = await googleDriveService.getSpreadsheetData(
        '1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w',
        'A:Z' // Try without sheet name first
      );
    } catch (error1) {
      console.log('First range failed, trying with sheet name...');
      try {
        data = await googleDriveService.getSpreadsheetData(
          '1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w',
          'A1:Z1000' // Try specific range
        );
      } catch (error2) {
        console.log('Second range failed, trying default...');
        data = await googleDriveService.getSpreadsheetData(
          '1ZQTP566D1SwYV6vosirm3B2dlkXShO_fad8MfrXNO5w'
        );
      }
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No data found in master sheet');
      return null;
    }
    
    // Get headers from first row
    const headers = data[0];
    console.log('📋 Sheet headers:', headers.join(', '));
    
    // Find relevant column indices
    const videoIdIndex = headers.findIndex(h => h.toLowerCase().includes('id'));
    const titleIndex = headers.findIndex(h => h.toLowerCase().includes('title'));
    const urlIndex = headers.findIndex(h => h.toLowerCase().includes('url'));
    const statusIndex = headers.findIndex(h => h.toLowerCase().includes('status'));
    
    console.log(`\nColumn indices:
- Video ID: ${videoIdIndex} (${headers[videoIdIndex] || 'Not found'})
- Title: ${titleIndex} (${headers[titleIndex] || 'Not found'})
- URL: ${urlIndex} (${headers[urlIndex] || 'Not found'})  
- Status: ${statusIndex} (${headers[statusIndex] || 'Not found'})`);
    
    // Process data rows (skip header row)
    const dataRows = data.slice(1);
    console.log(`\n📊 Total data rows: ${dataRows.length}`);
    
    // Find videos with "New" status
    const newVideos = [];
    
    dataRows.forEach((row, index) => {
      const videoId = row[videoIdIndex] || '';
      const title = row[titleIndex] || '';
      const url = row[urlIndex] || '';
      const status = row[statusIndex] || '';
      
      if (status.toLowerCase() === 'new' || status === '') {
        newVideos.push({
          rowIndex: index + 2, // +2 because we're 1-indexed and skipped header
          videoId,
          title,
          url,
          status: status || 'Empty'
        });
      }
    });
    
    console.log(`\n🔍 Found ${newVideos.length} videos with "New" or empty status:`);
    
    if (newVideos.length === 0) {
      console.log('❌ No videos with "New" status found');
      return null;
    }
    
    // Show first few videos
    const showCount = Math.min(5, newVideos.length);
    for (let i = 0; i < showCount; i++) {
      const video = newVideos[i];
      console.log(`${i + 1}. Row ${video.rowIndex}: ${video.videoId} - ${video.title || 'No title'}`);
      console.log(`   URL: ${video.url || 'No URL'}`);
      console.log(`   Status: ${video.status}`);
      console.log('');
    }
    
    if (newVideos.length > showCount) {
      console.log(`... and ${newVideos.length - showCount} more videos`);
    }
    
    // Return the first video for testing
    const firstVideo = newVideos[0];
    console.log(`\n🎯 First video selected for testing:`);
    console.log(`   Video ID: ${firstVideo.videoId}`);
    console.log(`   Title: ${firstVideo.title}`);
    console.log(`   URL: ${firstVideo.url}`);
    console.log(`   Row: ${firstVideo.rowIndex}`);
    
    return firstVideo;
    
  } catch (error) {
    console.error('❌ Error checking master sheet:', error.message);
    if (error.code) console.error('Error code:', error.code);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkMasterSheet().catch(console.error);
}

export default checkMasterSheet;