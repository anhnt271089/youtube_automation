#!/usr/bin/env node

/**
 * Complete Asset Downloads for VID-0037
 *
 * This script checks the current status of VID-0037 and completes any missing asset downloads.
 * Uses existing services to ensure consistency with the main application.
 */

import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AssetDownloadOrchestrator from '../src/services/assetDownloadOrchestrator.js';
import PexelsService from '../src/services/pexelsService.js';

const VIDEO_ID = 'VID-0037';

/**
 * Main execution function
 */
async function completeAssets() {
  const sheetsService = new GoogleSheetsService();
  const orchestrator = new AssetDownloadOrchestrator();
  const pexelsService = new PexelsService();

  try {
    console.log('\n=== VID-0037 Asset Completion Report ===\n');

    // Step 1: Check current status in Master Sheet
    console.log('📊 Step 1: Checking current status in Master Sheet...');
    const videoDetails = await sheetsService.getVideoDetails(VIDEO_ID);

    if (!videoDetails) {
      console.error(`❌ ERROR: Video ${VIDEO_ID} not found in Master Sheet`);
      process.exit(1);
    }

    console.log(`   Status: ${videoDetails.status || 'Unknown'}`);
    console.log(`   Script Approved: ${videoDetails.scriptApproved || 'Unknown'}`);
    console.log(`   Drive Folder: ${videoDetails.driveFolder ? 'Configured' : 'NOT CONFIGURED'}`);

    // Step 2: Check Script Breakdown sheet for asset status
    console.log('\n📝 Step 2: Checking Script Breakdown for asset status...');
    const scriptBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    if (!scriptBreakdown || scriptBreakdown.length === 0) {
      console.error(`❌ ERROR: No script breakdown found for ${VIDEO_ID}`);
      process.exit(1);
    }

    console.log(`   Total sentences: ${scriptBreakdown.length}`);

    // Analyze asset status
    const sentencesWithSearchPhrases = scriptBreakdown.filter(s =>
      s.searchPhrase && s.searchPhrase.trim() !== ''
    );

    const sentencesWithAssets = scriptBreakdown.filter(s =>
      s.imageUrl && s.imageUrl.trim() !== ''
    );

    const sentencesNeedingAssets = scriptBreakdown.filter(s =>
      s.searchPhrase && s.searchPhrase.trim() !== '' &&
      (!s.imageUrl || s.imageUrl.trim() === '')
    );

    console.log(`   Sentences with search phrases: ${sentencesWithSearchPhrases.length}`);
    console.log(`   Sentences with assets downloaded: ${sentencesWithAssets.length}`);
    console.log(`   Sentences missing assets: ${sentencesNeedingAssets.length}`);

    if (sentencesWithSearchPhrases.length > 0) {
      const completionPercentage = Math.round(
        (sentencesWithAssets.length / sentencesWithSearchPhrases.length) * 100
      );
      console.log(`   Completion: ${completionPercentage}% (${sentencesWithAssets.length}/${sentencesWithSearchPhrases.length})`);
    }

    // Step 3: Detailed missing assets report
    if (sentencesNeedingAssets.length > 0) {
      console.log('\n⚠️  Step 3: Missing Assets Details:');
      sentencesNeedingAssets.forEach((s, idx) => {
        console.log(`   ${idx + 1}. Sentence ${s.sentenceNumber || 'Unknown'}`);
        console.log(`      Search Phrase: "${s.searchPhrase}"`);
        console.log(`      Status: ${s.status || 'Unknown'}`);
      });
    } else {
      console.log('\n✅ Step 3: All assets are downloaded!');
    }

    // Step 4: Check if download is needed
    if (sentencesNeedingAssets.length === 0) {
      console.log('\n✨ RESULT: All assets are already downloaded. No action needed.');
      console.log(`   Final Status: ${videoDetails.status}`);
      console.log(`   Asset Coverage: 100% (${sentencesWithAssets.length}/${sentencesWithSearchPhrases.length})`);

      // Ensure status is "Completed" if all assets are present
      if (videoDetails.status !== 'Completed') {
        console.log('\n🔧 Updating status to "Completed"...');
        await sheetsService.updateMasterSheetStatus(VIDEO_ID, 'Completed');
        console.log('✅ Status updated to "Completed"');
      }

      return;
    }

    // Step 5: Download missing assets
    console.log(`\n🚀 Step 4: Downloading ${sentencesNeedingAssets.length} missing assets...`);
    console.log('   This may take a few minutes...\n');

    // Use the orchestrator to handle the download process
    const result = await orchestrator.handleScriptApproval(VIDEO_ID, {
      reason: 'Manual asset completion',
      triggeredBy: 'complete-vid-0037-assets script'
    });

    if (result.skipped) {
      console.log(`⏭️  Asset download skipped: ${result.reason}`);
      if (result.cooldownRemaining) {
        const minutes = Math.ceil(result.cooldownRemaining / (60 * 1000));
        console.log(`   Please wait ${minutes} minutes before trying again.`);
      }
      return;
    }

    if (result.success) {
      console.log('\n✅ SUCCESS: Asset download completed!');
      console.log(`   Downloaded: ${result.result?.successCount || 'N/A'} assets`);
      console.log(`   Failed: ${result.result?.failureCount || 0} assets`);
      console.log(`   Status: ${result.statusUpdate || 'Updated'}`);
    } else {
      console.log('\n❌ FAILURE: Asset download failed');
      console.log(`   Error: ${result.error || result.reason || 'Unknown error'}`);
      if (result.errors && result.errors.length > 0) {
        console.log('   Validation errors:');
        result.errors.forEach(err => console.log(`     - ${err}`));
      }
    }

    // Step 6: Final verification
    console.log('\n📊 Step 5: Final Verification...');
    const finalBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);
    const finalWithAssets = finalBreakdown.filter(s =>
      s.imageUrl && s.imageUrl.trim() !== ''
    );
    const finalWithSearchPhrases = finalBreakdown.filter(s =>
      s.searchPhrase && s.searchPhrase.trim() !== ''
    );

    const finalPercentage = finalWithSearchPhrases.length > 0
      ? Math.round((finalWithAssets.length / finalWithSearchPhrases.length) * 100)
      : 0;

    console.log(`   Assets Downloaded: ${finalWithAssets.length}/${finalWithSearchPhrases.length} (${finalPercentage}%)`);

    const finalVideoDetails = await sheetsService.getVideoDetails(VIDEO_ID);
    console.log(`   Master Sheet Status: ${finalVideoDetails.status}`);

    console.log('\n✅ Asset completion process finished!\n');

  } catch (error) {
    console.error('\n❌ ERROR during asset completion:', error.message);
    logger.error('Asset completion error:', error);
    process.exit(1);
  }
}

// Execute
completeAssets()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
