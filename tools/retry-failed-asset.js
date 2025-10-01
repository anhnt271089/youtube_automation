#!/usr/bin/env node

/**
 * Tool: Retry Failed Asset Download
 *
 * Retries downloading a specific failed sentence asset
 *
 * Usage:
 *   node tools/retry-failed-asset.js <videoId> <sentenceNumber>
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

const videoId = process.argv[2];
const sentenceNumber = process.argv[3];

if (!videoId || !sentenceNumber) {
  console.error('❌ Error: Both videoId and sentenceNumber are required');
  console.error('Usage: node tools/retry-failed-asset.js <videoId> <sentenceNumber>');
  console.error('Example: node tools/retry-failed-asset.js VID-0011 24');
  process.exit(1);
}

async function retryFailedAsset(videoId, sentenceNumber) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Retrying Asset Download for ${videoId} - Sentence ${sentenceNumber}`);
    console.log(`${'='.repeat(60)}\n`);

    const sheetsService = new GoogleSheetsService();
    const pexelsService = new PexelsService();

    // Get video details
    const videoDetails = await sheetsService.getVideoDetails(videoId);
    if (!videoDetails || !videoDetails.driveFolder) {
      throw new Error(`Drive folder not found for video: ${videoId}`);
    }

    const folderId = videoDetails.driveFolder.split('/folders/')[1];
    console.log(`📁 Drive Folder: ${videoDetails.driveFolder}`);

    // Get script breakdown
    const breakdown = await sheetsService.getScriptBreakdown(videoId);
    if (!breakdown || breakdown.length === 0) {
      throw new Error(`No script breakdown found for video: ${videoId}`);
    }

    // Find the specific sentence
    const sentence = breakdown.find(s => parseInt(s.sentenceNumber) === parseInt(sentenceNumber));
    if (!sentence) {
      throw new Error(`Sentence ${sentenceNumber} not found in breakdown`);
    }

    console.log(`📝 Sentence ${sentenceNumber}:`);
    console.log(`   Script: "${sentence.scriptText?.substring(0, 60)}..."`);
    console.log(`   Search Phrase: "${sentence.searchPhrase}"`);
    console.log(`   Current Status: ${sentence.status}`);
    console.log(`   Word Count: ${sentence.wordCount}`);

    // Reset status to Pending to allow retry
    console.log(`\n🔄 Resetting status to Pending...`);
    await sheetsService.updateSentenceWithImage(videoId, sentenceNumber, '', 'Pending');
    console.log(`   ✓ Status reset`);

    // Process the sentence
    console.log(`\n⬇️  Starting download...`);
    const result = await pexelsService.processSentenceAsset(videoId, sentence, folderId);

    console.log(`\n${'='.repeat(60)}`);
    if (result.success) {
      console.log('✅ Asset download successful!');
      console.log(`   File: ${result.filename}`);
      console.log(`   Type: ${result.assetType}`);
      console.log(`   Drive URL: ${result.driveUrl}`);
    } else {
      console.log('❌ Asset download failed');
      console.log(`   Reason: ${result.reason}`);
      if (result.error) {
        console.log(`   Error: ${result.error.message || result.error}`);
      }
    }
    console.log(`${'='.repeat(60)}\n`);

    return result;

  } catch (error) {
    console.error(`\n❌ Error retrying asset for ${videoId} S-${sentenceNumber}:`, error.message);
    throw error;
  }
}

// Execute
retryFailedAsset(videoId, sentenceNumber)
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(() => process.exit(1));
