#!/usr/bin/env node
/**
 * Diagnostic Tool: Find Videos with Missing Script Breakdowns
 *
 * This tool scans all videos in the system and identifies which ones
 * are missing script breakdown entries in Google Sheets.
 *
 * Usage: node tools/diagnose-missing-breakdowns.js [videoId]
 *        node tools/diagnose-missing-breakdowns.js           # Scan all videos
 *        node tools/diagnose-missing-breakdowns.js VID-0023  # Check specific video
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const VIDEO_ID_ARG = process.argv[2];

async function diagnoseVideo(sheetsService, videoId) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📊 DIAGNOSING: ${videoId}`);
  console.log('─'.repeat(80));

  const diagnosis = {
    videoId,
    hasMetadataFile: false,
    hasScriptContent: false,
    hasBreakdownEntries: false,
    scriptLength: 0,
    breakdownCount: 0,
    issues: [],
    recommendations: []
  };

  try {
    // Check 1: Metadata file exists
    console.log('\n🔍 CHECK 1: Metadata File');
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${videoId}.json`);
    try {
      await fs.access(metadataPath);
      diagnosis.hasMetadataFile = true;
      console.log('   ✅ Metadata file exists');

      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      console.log(`   📄 Script Generated: ${metadata.workflowMetadata?.scriptGenerated || false}`);
      console.log(`   📄 Processed At: ${metadata.workflowMetadata?.processedAt || 'N/A'}`);
    } catch (error) {
      diagnosis.hasMetadataFile = false;
      diagnosis.issues.push('Metadata file not found');
      console.log('   ❌ Metadata file not found');
    }

    // Check 2: Script content in Google Sheets
    console.log('\n🔍 CHECK 2: Script Content in Google Sheets');
    try {
      const scriptContent = await sheetsService.getExistingScriptContent(videoId);

      if (scriptContent && scriptContent.cleanVoiceScript) {
        diagnosis.hasScriptContent = true;
        diagnosis.scriptLength = scriptContent.cleanVoiceScript.length;
        console.log(`   ✅ Script content found: ${diagnosis.scriptLength} characters`);
        console.log(`   📝 Preview: ${scriptContent.cleanVoiceScript.substring(0, 100)}...`);
      } else {
        diagnosis.hasScriptContent = false;
        diagnosis.issues.push('No script content found in Video Info sheet');
        console.log('   ❌ No script content found in Video Info sheet');
      }
    } catch (error) {
      diagnosis.hasScriptContent = false;
      diagnosis.issues.push(`Error fetching script content: ${error.message}`);
      console.log(`   ❌ Error fetching script content: ${error.message}`);
    }

    // Check 3: Script Breakdown entries
    console.log('\n🔍 CHECK 3: Script Breakdown Entries');
    try {
      const breakdown = await sheetsService.getScriptBreakdown(videoId);

      if (breakdown && breakdown.length > 0) {
        diagnosis.hasBreakdownEntries = true;
        diagnosis.breakdownCount = breakdown.length;
        console.log(`   ✅ Script Breakdown exists: ${diagnosis.breakdownCount} entries`);

        // Show sample entries
        console.log('\n   📋 Sample entries:');
        for (let i = 0; i < Math.min(3, breakdown.length); i++) {
          console.log(`   ${i + 1}. ${breakdown[i].scriptText?.substring(0, 50) || 'N/A'}...`);
        }
      } else {
        diagnosis.hasBreakdownEntries = false;
        diagnosis.issues.push('No Script Breakdown entries found');
        console.log('   ❌ No Script Breakdown entries found');
      }
    } catch (error) {
      diagnosis.hasBreakdownEntries = false;
      diagnosis.issues.push(`Error fetching breakdown: ${error.message}`);
      console.log(`   ❌ Error fetching breakdown: ${error.message}`);
    }

    // Generate recommendations
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log(`   Metadata File: ${diagnosis.hasMetadataFile ? '✅' : '❌'}`);
    console.log(`   Script Content: ${diagnosis.hasScriptContent ? '✅' : '❌'}`);
    console.log(`   Breakdown Entries: ${diagnosis.hasBreakdownEntries ? '✅' : '❌'}`);

    if (diagnosis.hasScriptContent && !diagnosis.hasBreakdownEntries) {
      diagnosis.recommendations.push(`Run: node tools/fix-missing-breakdown.js ${videoId}`);
      console.log('\n💡 RECOMMENDATION:');
      console.log(`   ⚡ Script exists but breakdown is missing`);
      console.log(`   🔧 Fix command: node tools/fix-missing-breakdown.js ${videoId}`);
    } else if (!diagnosis.hasScriptContent && !diagnosis.hasBreakdownEntries) {
      diagnosis.recommendations.push('Video needs to be processed completely - script generation required first');
      console.log('\n💡 RECOMMENDATION:');
      console.log(`   ⚠️  Video needs complete processing - no script content found`);
      console.log(`   🔧 Script must be generated before breakdown can be created`);
    } else if (diagnosis.hasBreakdownEntries) {
      console.log('\n✅ STATUS: Video has complete breakdown');
    }

    if (diagnosis.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      diagnosis.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

  } catch (error) {
    console.error(`\n❌ ERROR diagnosing ${videoId}:`, error.message);
    diagnosis.issues.push(`Fatal error: ${error.message}`);
  }

  console.log(`\n${'─'.repeat(80)}\n`);
  return diagnosis;
}

async function scanAllVideos() {
  const sheetsService = new GoogleSheetsService();

  console.log('\n' + '='.repeat(80));
  console.log('🔍 SCANNING ALL VIDEOS FOR MISSING SCRIPT BREAKDOWNS');
  console.log('='.repeat(80));

  try {
    // Get all videos from Master Sheet
    console.log('\n📋 Fetching all videos from Master Sheet...');
    const videos = await sheetsService.getAllVideos();
    console.log(`✅ Found ${videos.length} videos to check`);

    const results = {
      total: videos.length,
      withBreakdown: [],
      missingBreakdown: [],
      noScript: [],
      errors: []
    };

    // Check each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      console.log(`\n[${i + 1}/${videos.length}] Checking ${video.videoId}...`);

      try {
        // Check if script content exists
        const scriptContent = await sheetsService.getExistingScriptContent(video.videoId);

        if (!scriptContent || !scriptContent.cleanVoiceScript) {
          results.noScript.push(video.videoId);
          console.log(`   ⚠️  No script content`);
          continue;
        }

        // Check if breakdown exists
        const breakdown = await sheetsService.getScriptBreakdown(video.videoId);

        if (!breakdown || breakdown.length === 0) {
          results.missingBreakdown.push({
            videoId: video.videoId,
            title: video.title,
            scriptLength: scriptContent.cleanVoiceScript.length
          });
          console.log(`   ❌ Missing breakdown (has script: ${scriptContent.cleanVoiceScript.length} chars)`);
        } else {
          results.withBreakdown.push({
            videoId: video.videoId,
            breakdownCount: breakdown.length
          });
          console.log(`   ✅ Has breakdown (${breakdown.length} entries)`);
        }

      } catch (error) {
        results.errors.push({
          videoId: video.videoId,
          error: error.message
        });
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Print summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SCAN RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📈 Total Videos: ${results.total}`);
    console.log(`✅ With Breakdown: ${results.withBreakdown.length}`);
    console.log(`❌ Missing Breakdown: ${results.missingBreakdown.length}`);
    console.log(`⚠️  No Script Content: ${results.noScript.length}`);
    console.log(`💥 Errors: ${results.errors.length}`);

    if (results.missingBreakdown.length > 0) {
      console.log('\n🔧 VIDEOS MISSING BREAKDOWN (CAN BE FIXED):');
      console.log('─'.repeat(80));
      results.missingBreakdown.forEach((item, i) => {
        console.log(`${i + 1}. ${item.videoId} - ${item.title?.substring(0, 50) || 'N/A'}...`);
        console.log(`   Script: ${item.scriptLength} characters`);
        console.log(`   Fix: node tools/fix-missing-breakdown.js ${item.videoId}`);
        console.log('');
      });

      console.log('\n💡 BATCH FIX COMMAND:');
      console.log('   To fix all videos with missing breakdowns:');
      console.log('   ');
      results.missingBreakdown.forEach(item => {
        console.log(`   node tools/fix-missing-breakdown.js ${item.videoId}`);
      });
    }

    if (results.noScript.length > 0) {
      console.log('\n⚠️  VIDEOS WITHOUT SCRIPT CONTENT (NEED FULL PROCESSING):');
      console.log('─'.repeat(80));
      results.noScript.forEach((videoId, i) => {
        console.log(`${i + 1}. ${videoId}`);
      });
    }

    if (results.errors.length > 0) {
      console.log('\n💥 VIDEOS WITH ERRORS:');
      console.log('─'.repeat(80));
      results.errors.forEach((item, i) => {
        console.log(`${i + 1}. ${item.videoId}: ${item.error}`);
      });
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return results;

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const sheetsService = new GoogleSheetsService();

  if (VIDEO_ID_ARG) {
    // Diagnose specific video
    await diagnoseVideo(sheetsService, VIDEO_ID_ARG);
  } else {
    // Scan all videos
    await scanAllVideos();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
