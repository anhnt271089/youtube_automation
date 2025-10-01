#!/usr/bin/env node

/**
 * Tool: Check Asset Download Status
 *
 * Checks the current status of asset downloads for a specific video
 *
 * Usage:
 *   node tools/check-asset-status.js <videoId>
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import PexelsService from '../src/services/pexelsService.js';
import logger from '../src/utils/logger.js';

const videoId = process.argv[2];

if (!videoId) {
  console.error('❌ Error: Video ID is required');
  console.error('Usage: node tools/check-asset-status.js <videoId>');
  process.exit(1);
}

async function checkAssetStatus(videoId) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Asset Status Check for ${videoId}`);
    console.log(`${'='.repeat(60)}\n`);

    const sheetsService = new GoogleSheetsService();
    const pexelsService = new PexelsService();

    // Get video details
    const videoDetails = await sheetsService.getVideoDetails(videoId);
    if (!videoDetails) {
      throw new Error(`Video not found: ${videoId}`);
    }

    console.log('📋 Video Information:');
    console.log(`   Title: ${videoDetails.title}`);
    console.log(`   Status: ${videoDetails.status}`);
    console.log(`   Script Approved: ${videoDetails.scriptApproved}`);
    console.log(`   Drive Folder: ${videoDetails.driveFolder}`);

    // Get script breakdown
    const breakdown = await sheetsService.getScriptBreakdown(videoId);
    if (!breakdown || breakdown.length === 0) {
      console.log('\n❌ No script breakdown found');
      return;
    }

    console.log(`\n📝 Script Breakdown: ${breakdown.length} total sentences`);

    // Categorize sentences
    const categories = {
      complete: [],
      downloading: [],
      pending: [],
      failed: [],
      other: []
    };

    breakdown.forEach(sentence => {
      const status = sentence.status || 'Pending';
      if (status === 'Complete' || status === 'Generated') {
        categories.complete.push(sentence);
      } else if (status === 'Downloading') {
        categories.downloading.push(sentence);
      } else if (status === 'Pending' || status === '') {
        categories.pending.push(sentence);
      } else if (status.includes('Failed')) {
        categories.failed.push(sentence);
      } else {
        categories.other.push(sentence);
      }
    });

    console.log('\n📊 Status Breakdown:');
    console.log(`   ✅ Complete: ${categories.complete.length}`);
    console.log(`   ⬇️  Downloading: ${categories.downloading.length}`);
    console.log(`   ⏳ Pending: ${categories.pending.length}`);
    console.log(`   ❌ Failed: ${categories.failed.length}`);
    if (categories.other.length > 0) {
      console.log(`   ❓ Other: ${categories.other.length}`);
    }

    // Show completion percentage
    const completionRate = Math.round((categories.complete.length / breakdown.length) * 100);
    console.log(`\n📈 Completion Rate: ${completionRate}%`);

    // Show sentences currently downloading
    if (categories.downloading.length > 0) {
      console.log('\n⬇️  Currently Downloading:');
      categories.downloading.forEach(s => {
        console.log(`   S-${s.sentenceNumber}: "${s.searchPhrase}"`);
      });
    }

    // Show failed sentences
    if (categories.failed.length > 0) {
      console.log('\n❌ Failed Sentences:');
      categories.failed.forEach(s => {
        console.log(`   S-${s.sentenceNumber}: "${s.searchPhrase}" (${s.status})`);
      });
    }

    // Show pending sentences (first 10)
    if (categories.pending.length > 0) {
      console.log('\n⏳ Pending Sentences (showing first 10):');
      categories.pending.slice(0, 10).forEach(s => {
        console.log(`   S-${s.sentenceNumber}: "${s.searchPhrase}"`);
      });
      if (categories.pending.length > 10) {
        console.log(`   ... and ${categories.pending.length - 10} more`);
      }
    }

    // Asset type breakdown for completed
    if (categories.complete.length > 0) {
      const videos = categories.complete.filter(s => s.imageUrl && s.imageUrl.includes('.mp4'));
      const photos = categories.complete.filter(s => s.imageUrl && s.imageUrl.includes('.jpg'));
      console.log('\n🎬 Asset Types (Complete):');
      console.log(`   Videos: ${videos.length}`);
      console.log(`   Photos: ${photos.length}`);
    }

    console.log(`\n${'='.repeat(60)}\n`);

    return {
      total: breakdown.length,
      complete: categories.complete.length,
      downloading: categories.downloading.length,
      pending: categories.pending.length,
      failed: categories.failed.length,
      completionRate
    };

  } catch (error) {
    console.error(`\n❌ Error checking status for ${videoId}:`, error.message);
    throw error;
  }
}

// Execute
checkAssetStatus(videoId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
