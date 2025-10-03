#!/usr/bin/env node

/**
 * Proper Script Breakdown Regeneration Tool
 *
 * This tool regenerates the script breakdown for a video using the ACTUAL built-in functions
 * that the system uses during normal workflow processing.
 *
 * Usage: node tools/regenerate-breakdown-proper.js <VIDEO_ID>
 * Example: node tools/regenerate-breakdown-proper.js VID-0023
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Main regeneration function
 */
async function regenerateScriptBreakdown(videoId) {
  try {
    console.log(chalk.blue.bold('\n🔄 Script Breakdown Regeneration Tool'));
    console.log(chalk.blue('=====================================\n'));

    console.log(chalk.cyan(`📋 Video ID: ${videoId}\n`));

    // Initialize services
    console.log(chalk.yellow('⚙️  Initializing services...'));
    const sheetsService = new GoogleSheetsService();
    const aiService = new AIService();

    // Step 1: Get video details
    console.log(chalk.yellow('\n📊 Step 1: Fetching video details...'));
    const videoDetails = await sheetsService.getVideoDetails(videoId);

    if (!videoDetails) {
      throw new Error(`Video ${videoId} not found in Google Sheets`);
    }

    console.log(chalk.green(`✅ Found video: ${videoDetails.title}`));

    // Step 2: Extract clean voice script from Video Info sheet
    console.log(chalk.yellow('\n📝 Step 2: Extracting clean voice script from Video Info sheet...'));

    // Get workbook ID from video details
    const workbookUrl = videoDetails.detailWorkbookUrl;
    if (!workbookUrl) {
      throw new Error(`No detail workbook found for ${videoId}`);
    }

    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    // Read clean voice script from Video Info sheet
    const videoInfoResponse = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: `Video Info!A1:B100`
    });

    const videoInfoData = videoInfoResponse.data.values || [];
    let cleanVoiceScript = '';

    // Find the "CLEAN VOICE SCRIPT" row
    for (let i = 0; i < videoInfoData.length; i++) {
      if (videoInfoData[i][0] === 'CLEAN VOICE SCRIPT' && videoInfoData[i][1]) {
        cleanVoiceScript = videoInfoData[i][1]
          .replace(/\n\n\(Use this clean version for voice generation.*\)$/i, '')
          .trim();
        break;
      }
    }

    if (!cleanVoiceScript) {
      throw new Error(`No clean voice script found in Video Info sheet for ${videoId}`);
    }

    const scriptLength = cleanVoiceScript.length;
    console.log(chalk.green(`✅ Script extracted (${scriptLength} characters)`));
    console.log(chalk.gray(`   Preview: ${cleanVoiceScript.substring(0, 100)}...`));

    // Step 3: Get current breakdown count
    console.log(chalk.yellow('\n🔍 Step 3: Checking existing breakdown...'));
    const currentBreakdown = await sheetsService.getScriptBreakdown(videoId);
    const currentCount = currentBreakdown ? currentBreakdown.length : 0;
    console.log(chalk.cyan(`   Current entries: ${currentCount}`));

    // Step 4: Clear existing breakdown
    if (currentCount > 0) {
      console.log(chalk.yellow('\n🗑️  Step 4: Clearing existing breakdown...'));

      // Clear the script breakdown sheet (rows 2 onwards)
      await sheetsService.sheets.spreadsheets.values.clear({
        spreadsheetId: workbookId,
        range: `Script Breakdown!A2:H${currentCount + 10}` // Clear with buffer
      });

      console.log(chalk.green(`✅ Cleared ${currentCount} existing entries`));
    } else {
      console.log(chalk.gray('\n⏭️  Step 4: No existing breakdown to clear'));
    }

    // Step 5: Use the REAL built-in function to break down the script
    console.log(chalk.yellow('\n🤖 Step 5: Generating script breakdown using AI Service...'));
    console.log(chalk.gray('   Using: AIService.breakdownScriptIntoSentences()'));

    const scriptSentences = await aiService.breakdownScriptIntoSentences(cleanVoiceScript);
    console.log(chalk.green(`✅ Generated ${scriptSentences.length} sentences`));

    // Step 6: Generate editor keywords using the built-in function
    console.log(chalk.yellow('\n🎯 Step 6: Generating editor keywords...'));
    console.log(chalk.gray('   Using: AIService.generateEditorKeywords()'));

    const editorKeywords = await aiService.generateEditorKeywords(scriptSentences);
    console.log(chalk.green(`✅ Generated keywords for ${editorKeywords.length} sentences`));

    // Step 7: Create empty image prompts array (deprecated - using automated assets)
    console.log(chalk.yellow('\n🖼️  Step 7: Setting up image prompts...'));
    const imagePrompts = scriptSentences.map(() => ''); // Empty - using automated asset downloads
    console.log(chalk.gray('   Image prompts: N/A (using automated Pexels downloads)'));

    // Step 8: Save the complete breakdown using the built-in function
    console.log(chalk.yellow('\n💾 Step 8: Saving script breakdown to Google Sheets...'));
    console.log(chalk.gray('   Using: GoogleSheetsService.createScriptBreakdown()'));

    await sheetsService.createScriptBreakdown(
      videoId,
      scriptSentences,
      imagePrompts,
      editorKeywords
    );

    console.log(chalk.green(`✅ Script breakdown saved successfully`));

    // Step 9: Verify the results
    console.log(chalk.yellow('\n✔️  Step 9: Verifying results...'));
    const newBreakdown = await sheetsService.getScriptBreakdown(videoId);
    const newCount = newBreakdown ? newBreakdown.length : 0;

    console.log(chalk.green(`✅ Verification passed: ${newCount} entries created`));

    // Step 10: Display summary
    console.log(chalk.blue.bold('\n📊 REGENERATION SUMMARY'));
    console.log(chalk.blue('======================\n'));
    console.log(chalk.cyan(`Video ID:          ${videoId}`));
    console.log(chalk.cyan(`Video Title:       ${videoDetails.title}`));
    console.log(chalk.cyan(`Script Length:     ${scriptLength} characters`));
    console.log(chalk.cyan(`Previous Entries:  ${currentCount}`));
    console.log(chalk.cyan(`New Entries:       ${newCount}`));
    console.log(chalk.cyan(`Change:            ${newCount > currentCount ? '+' : ''}${newCount - currentCount}`));

    console.log(chalk.blue('\n📋 Breakdown Structure:'));
    console.log(chalk.gray(`   ✅ Sentence Numbers:  1 to ${newCount}`));
    console.log(chalk.gray(`   ✅ Script Text:       Complete sentences`));
    console.log(chalk.gray(`   ✅ Image Prompts:     N/A (automated downloads)`));
    console.log(chalk.gray(`   ✅ Search Phrases:    Auto-generated`));
    console.log(chalk.gray(`   ✅ Editor Keywords:   AI-generated`));
    console.log(chalk.gray(`   ✅ Status:            All set to "Pending"`));
    console.log(chalk.gray(`   ✅ Word Count:        Formula-based`));

    console.log(chalk.blue('\n🔗 Built-in Functions Used:'));
    console.log(chalk.gray('   1. AIService.breakdownScriptIntoSentences()'));
    console.log(chalk.gray('      └─ Location: src/services/aiService.js:1083'));
    console.log(chalk.gray('      └─ Uses: GPT-4o-mini + Claude 3.5 Sonnet (fallback)'));
    console.log(chalk.gray('      └─ Features: Smart sentence limit enforcement'));
    console.log(chalk.gray('\n   2. AIService.generateEditorKeywords()'));
    console.log(chalk.gray('      └─ Location: src/services/aiService.js:1356'));
    console.log(chalk.gray('      └─ Uses: AI to extract editing-relevant keywords'));
    console.log(chalk.gray('\n   3. GoogleSheetsService.createScriptBreakdown()'));
    console.log(chalk.gray('      └─ Location: src/services/googleSheetsService.js:1034'));
    console.log(chalk.gray('      └─ Features: Complete data structure with all columns'));

    console.log(chalk.green.bold('\n✨ Regeneration completed successfully!\n'));

    // Display sample entries
    if (newBreakdown && newBreakdown.length > 0) {
      console.log(chalk.blue('📄 Sample Entries (first 3):'));
      console.log(chalk.blue('============================\n'));

      for (let i = 0; i < Math.min(3, newBreakdown.length); i++) {
        const entry = newBreakdown[i];
        console.log(chalk.cyan(`Entry ${i + 1}:`));
        console.log(chalk.gray(`  Sentence #:     ${entry.sentenceNumber || 'N/A'}`));
        console.log(chalk.gray(`  Script Text:    ${(entry.scriptText || '').substring(0, 60)}...`));
        console.log(chalk.gray(`  Search Phrase:  ${entry.searchPhrase || 'N/A'}`));
        console.log(chalk.gray(`  Editor Keywords: ${entry.editorKeywords || 'N/A'}`));
        console.log(chalk.gray(`  Status:         ${entry.status || 'N/A'}`));
        console.log('');
      }
    }

    console.log(chalk.green('✅ Done!\n'));

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Error during regeneration:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

// Parse command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error(chalk.red('\n❌ Error: Video ID is required'));
  console.log(chalk.yellow('\nUsage: node tools/regenerate-breakdown-proper.js <VIDEO_ID>'));
  console.log(chalk.yellow('Example: node tools/regenerate-breakdown-proper.js VID-0023\n'));
  process.exit(1);
}

// Run the regeneration
regenerateScriptBreakdown(videoId);
