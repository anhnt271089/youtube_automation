import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const sheetsService = new GoogleSheetsService();

async function fixUndefinedImagePrompts() {
  try {
    console.log('🔧 Fixing undefined image prompts in Script Breakdown sheets...');
    
    // Get all videos to find ones with detail workbooks
    const allVideos = await sheetsService.getAllVideos();
    console.log(`📊 Found ${allVideos.length} videos total`);
    
    let processedVideos = 0;
    let fixedPrompts = 0;
    
    for (const video of allVideos) {
      if (!video.detailWorkbookUrl) {
        continue; // Skip videos without detail workbooks
      }
      
      console.log(`\n🎬 Processing: ${video.videoId} - ${video.title}`);
      
      try {
        const workbookUrl = video.detailWorkbookUrl;
        const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
        
        // Get current data from Script Breakdown sheet
        const response = await sheetsService.sheets.spreadsheets.values.get({
          spreadsheetId: workbookId,
          range: 'Script Breakdown!A:G'
        });
        
        const values = response.data.values || [];
        
        if (values.length <= 1) {
          console.log('   ⚠️ No data found in Script Breakdown sheet');
          continue;
        }
        
        // Process each row to fix undefined prompts
        let hasChanges = false;
        const updatedValues = [];
        
        // Keep header row as is
        updatedValues.push(values[0]);
        
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          
          // Check if row has data and image prompt column (index 2)
          if (row && row.length > 2 && row[2]) {
            let imagePrompt = row[2];
            
            // Check if prompt starts with "undefined, "
            if (imagePrompt.startsWith('undefined, ')) {
              // Remove the "undefined, " prefix
              const cleanedPrompt = imagePrompt.substring(11); // Remove "undefined, "
              row[2] = cleanedPrompt;
              hasChanges = true;
              fixedPrompts++;
              console.log(`   ✅ Fixed prompt in row ${i + 1}`);
            }
          }
          
          updatedValues.push(row);
        }
        
        // Update the sheet if there were changes
        if (hasChanges) {
          await sheetsService.sheets.spreadsheets.values.update({
            spreadsheetId: workbookId,
            range: `Script Breakdown!A1:G${updatedValues.length}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: updatedValues
            }
          });
          
          console.log(`   🎉 Updated ${video.videoId} with cleaned prompts`);
        } else {
          console.log(`   ✅ No undefined prompts found in ${video.videoId}`);
        }
        
        processedVideos++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error processing ${video.videoId}:`, error.message);
        continue;
      }
    }
    
    console.log(`\n🎯 Fix Summary:`);
    console.log(`   📊 Videos processed: ${processedVideos}`);
    console.log(`   🔧 Image prompts fixed: ${fixedPrompts}`);
    
    if (fixedPrompts > 0) {
      console.log(`\n✅ Successfully removed "undefined, " prefix from ${fixedPrompts} image prompts!`);
      console.log(`🎉 Image prompts should now display correctly in Script Breakdown tabs.`);
    } else {
      console.log(`\n✅ No undefined prompts found - all data is clean!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing undefined image prompts:', error.message);
  }
}

fixUndefinedImagePrompts();