#!/usr/bin/env node

/**
 * Force Download Remaining Assets for VID-0037
 * Resets stuck downloads and processes remaining assets
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';

const VIDEO_ID = 'VID-0037';

async function forceDownload() {
  const sheetsService = new GoogleSheetsService();
  const pexelsService = new PexelsService();

  try {
    console.log('\n=== Force Download VID-0037 Assets ===\n');

    // Step 1: Get current status
    console.log('📊 Checking current status...');
    const scriptBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    const sentencesStuck = scriptBreakdown.filter(s =>
      s.status === 'Downloading' &&
      s.searchPhrase && s.searchPhrase.trim() !== '' &&
      (!s.imageUrl || s.imageUrl.trim() === '')
    );

    const sentencesPending = scriptBreakdown.filter(s =>
      (s.status === 'Pending' || !s.status) &&
      s.searchPhrase && s.searchPhrase.trim() !== '' &&
      (!s.imageUrl || s.imageUrl.trim() === '')
    );

    console.log(`   Stuck in Downloading: ${sentencesStuck.length}`);
    console.log(`   Pending: ${sentencesPending.length}`);

    // Step 2: Reset stuck downloads
    if (sentencesStuck.length > 0) {
      console.log('\n🔧 Resetting stuck downloads...');
      for (const sentence of sentencesStuck) {
        await sheetsService.updateSentenceStatus(VIDEO_ID, sentence.sentenceNumber, 'Pending');
        console.log(`   ✅ Reset sentence ${sentence.sentenceNumber}`);
      }
    }

    // Step 3: Process all pending sentences
    const allPending = [...sentencesStuck, ...sentencesPending];
    console.log(`\n🚀 Processing ${allPending.length} sentences...`);

    // Update Master Sheet status
    await sheetsService.updateMasterSheetStatus(VIDEO_ID, 'Downloading Assets');

    // Process using PexelsService
    const result = await pexelsService.processScriptBreakdownAssets(VIDEO_ID);

    console.log('\n✅ Download completed!');
    console.log(`   Success: ${result.successCount}`);
    console.log(`   Failed: ${result.failureCount}`);
    console.log(`   Total: ${result.totalSentences}`);

    // Update status based on results
    if (result.failureCount === 0) {
      await sheetsService.updateMasterSheetStatus(VIDEO_ID, 'Completed');
      console.log('\n🎉 All assets downloaded! Status updated to "Completed"');
    } else {
      console.log(`\n⚠️  ${result.failureCount} assets failed. Status remains "Downloading Assets"`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

forceDownload()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
