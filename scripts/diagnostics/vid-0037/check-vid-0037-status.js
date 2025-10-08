#!/usr/bin/env node

/**
 * Quick Status Check for VID-0037
 * Provides a fast status report without triggering downloads
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';

const VIDEO_ID = 'VID-0037';

async function checkStatus() {
  const sheetsService = new GoogleSheetsService();

  try {
    console.log('\n=== VID-0037 Quick Status Report ===\n');

    // Get Master Sheet status
    const videoDetails = await sheetsService.getVideoDetails(VIDEO_ID);
    console.log('📊 Master Sheet Status:');
    console.log(`   Current Status: ${videoDetails?.status || 'Unknown'}`);
    console.log(`   Script Approved: ${videoDetails?.scriptApproved || 'Unknown'}`);

    // Get Script Breakdown asset status
    const scriptBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    const sentencesWithSearchPhrases = scriptBreakdown.filter(s =>
      s.searchPhrase && s.searchPhrase.trim() !== ''
    );

    const sentencesWithAssets = scriptBreakdown.filter(s =>
      s.imageUrl && s.imageUrl.trim() !== ''
    );

    const sentencesComplete = scriptBreakdown.filter(s =>
      s.status === 'Complete' || s.status === 'Generated'
    );

    const sentencesDownloading = scriptBreakdown.filter(s =>
      s.status === 'Downloading'
    );

    const sentencesPending = scriptBreakdown.filter(s =>
      s.status === 'Pending' || !s.status
    );

    const sentencesFailed = scriptBreakdown.filter(s =>
      s.status === 'Failed'
    );

    console.log('\n📝 Script Breakdown Status:');
    console.log(`   Total Sentences: ${scriptBreakdown.length}`);
    console.log(`   With Search Phrases: ${sentencesWithSearchPhrases.length}`);
    console.log(`   With Assets: ${sentencesWithAssets.length}`);
    console.log(`   Complete: ${sentencesComplete.length}`);
    console.log(`   Downloading: ${sentencesDownloading.length}`);
    console.log(`   Pending: ${sentencesPending.length}`);
    console.log(`   Failed: ${sentencesFailed.length}`);

    if (sentencesWithSearchPhrases.length > 0) {
      const completionPercentage = Math.round(
        (sentencesWithAssets.length / sentencesWithSearchPhrases.length) * 100
      );
      console.log(`\n✨ Asset Completion: ${completionPercentage}% (${sentencesWithAssets.length}/${sentencesWithSearchPhrases.length})`);
    }

    // Show currently downloading if any
    if (sentencesDownloading.length > 0) {
      console.log('\n⏳ Currently Downloading:');
      sentencesDownloading.forEach(s => {
        console.log(`   - Sentence ${s.sentenceNumber}: "${s.searchPhrase}"`);
      });
    }

    // Show pending if any
    if (sentencesPending.length > 0 && sentencesPending.length <= 10) {
      console.log('\n⏸️  Pending (next to download):');
      sentencesPending.slice(0, 5).forEach(s => {
        console.log(`   - Sentence ${s.sentenceNumber}: "${s.searchPhrase}"`);
      });
      if (sentencesPending.length > 5) {
        console.log(`   ... and ${sentencesPending.length - 5} more`);
      }
    } else if (sentencesPending.length > 10) {
      console.log(`\n⏸️  Pending: ${sentencesPending.length} sentences`);
    }

    // Show failed if any
    if (sentencesFailed.length > 0) {
      console.log('\n❌ Failed Downloads:');
      sentencesFailed.forEach(s => {
        console.log(`   - Sentence ${s.sentenceNumber}: "${s.searchPhrase}"`);
      });
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
