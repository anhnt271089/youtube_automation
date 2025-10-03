#!/usr/bin/env node
/**
 * Fix Missing Script Breakdown
 *
 * This script regenerates the Script Breakdown for any video that has script
 * content but is missing breakdown entries in Google Sheets.
 *
 * Usage: node tools/fix-missing-breakdown.js <VIDEO_ID>
 * Example: node tools/fix-missing-breakdown.js VID-0023
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

const VIDEO_ID = process.argv[2];

if (!VIDEO_ID) {
  console.error('\n❌ ERROR: Video ID is required');
  console.error('Usage: node tools/fix-missing-breakdown.js <VIDEO_ID>');
  console.error('Example: node tools/fix-missing-breakdown.js VID-0023\n');
  process.exit(1);
}

// Validate VIDEO_ID format
if (!VIDEO_ID.match(/^VID-\d{4}$/)) {
  console.error('\n❌ ERROR: Invalid video ID format');
  console.error('Expected format: VID-XXXX (e.g., VID-0023)\n');
  process.exit(1);
}

async function fixScriptBreakdown() {
  const sheetsService = new GoogleSheetsService();
  const aiService = new AIService();

  console.log('\n' + '='.repeat(80));
  console.log(`🔧 FIX: Regenerating Script Breakdown for ${VIDEO_ID}`);
  console.log('='.repeat(80));

  try {
    // Step 0: Check if breakdown already exists
    console.log('\n📋 STEP 0: Checking existing breakdown...');
    const existingBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    if (existingBreakdown && existingBreakdown.length > 0) {
      console.log(`⚠️  WARNING: Script Breakdown already exists with ${existingBreakdown.length} entries`);
      console.log('\nOptions:');
      console.log('  1. Exit without changes (recommended if breakdown looks correct)');
      console.log('  2. Delete and regenerate (only if breakdown is corrupted)');
      console.log('\n💡 To proceed with regeneration, delete the existing breakdown first');
      console.log(`   or use: node tools/regenerate-breakdown.js ${VIDEO_ID} --force\n`);
      process.exit(0);
    }

    console.log('✅ No existing breakdown found - safe to proceed');

    // Step 1: Get existing script content
    console.log('\n📋 STEP 1: Retrieving existing script content...');
    const scriptContent = await sheetsService.getExistingScriptContent(VIDEO_ID);

    if (!scriptContent || !scriptContent.cleanVoiceScript) {
      console.log(`❌ ERROR: No script content found for ${VIDEO_ID}`);
      console.log('\n💡 Script must be generated before breakdown can be created');
      console.log(`   Check if video has been processed: node tools/diagnose-missing-breakdowns.js ${VIDEO_ID}\n`);
      process.exit(1);
    }

    const script = scriptContent.cleanVoiceScript;
    console.log(`✅ Found script: ${script.length} characters`);
    console.log(`📝 Preview: ${script.substring(0, 150)}...`);

    // Step 2: Break script into sentences
    console.log('\n📋 STEP 2: Breaking script into sentences...');

    // Split by double newlines first (existing sentence separation)
    let sentences = script.split('\n\n').filter(s => s.trim());

    // If no double-newline separation, try single periods
    if (sentences.length === 1) {
      sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 10);
    }

    console.log(`✅ Extracted ${sentences.length} sentences`);

    if (sentences.length === 0) {
      console.log('❌ ERROR: No sentences could be extracted from script');
      console.log('   Script content may be malformed\n');
      process.exit(1);
    }

    // Show sentence preview
    console.log('\n📄 Sentence Preview:');
    for (let i = 0; i < Math.min(3, sentences.length); i++) {
      console.log(`   ${i + 1}. ${sentences[i].trim().substring(0, 80)}...`);
    }

    // Step 3: Generate image prompts for each sentence
    console.log('\n📋 STEP 3: Generating image prompts...');

    const imagePrompts = [];
    const editorKeywords = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const progress = `[${i + 1}/${sentences.length}]`;

      try {
        // Generate image prompt using AI service
        const prompt = await aiService.generateImagePrompt(sentence, i + 1);
        imagePrompts.push(prompt);

        // Extract keywords for editor
        const keywords = extractKeywords(sentence);
        editorKeywords.push(keywords);

        successCount++;
        console.log(`   ✅ ${progress} Generated prompt for: "${sentence.substring(0, 60)}..."`);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        failCount++;
        console.log(`   ⚠️  ${progress} Error generating prompt: ${error.message}`);

        // Use fallback prompt
        const fallbackPrompt = `Visual representation of: ${sentence.substring(0, 100)}`;
        imagePrompts.push(fallbackPrompt);
        editorKeywords.push('');

        console.log(`   📝 ${progress} Using fallback: "${fallbackPrompt}"`);
      }
    }

    console.log(`\n✅ Image prompt generation complete:`);
    console.log(`   Success: ${successCount}/${sentences.length}`);
    console.log(`   Fallback: ${failCount}/${sentences.length}`);

    // Step 4: Create Script Breakdown in Google Sheets
    console.log('\n📋 STEP 4: Creating Script Breakdown entries...');

    await sheetsService.createScriptBreakdown(
      VIDEO_ID,
      sentences,
      imagePrompts,
      editorKeywords
    );

    console.log(`✅ Successfully created ${sentences.length} Script Breakdown entries`);

    // Step 5: Verify the fix
    console.log('\n📋 STEP 5: Verifying the fix...');

    const breakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    if (breakdown && breakdown.length > 0) {
      console.log(`✅ VERIFICATION PASSED: Script Breakdown now has ${breakdown.length} entries`);

      console.log('\n📊 Sample entries:');
      for (let i = 0; i < Math.min(3, breakdown.length); i++) {
        console.log(`\n   ${i + 1}. Sentence ${breakdown[i].sentenceNumber}`);
        console.log(`      Text: ${breakdown[i].scriptText.substring(0, 60)}...`);
        console.log(`      Image Prompt: ${breakdown[i].imagePrompt.substring(0, 60)}...`);
        console.log(`      Search Phrase: ${breakdown[i].searchPhrase || 'N/A'}`);
        console.log(`      Keywords: ${breakdown[i].editorKeywords || 'N/A'}`);
        console.log(`      Status: ${breakdown[i].status || 'N/A'}`);
      }

      console.log('\n✅ FIX COMPLETED SUCCESSFULLY!');
      console.log('\n💡 Next Steps:');
      console.log(`   1. Review breakdown in Google Sheets`);
      console.log(`   2. Download assets: node src/schedulers/assetScheduler.js`);
      console.log(`   3. Check asset status in Script Breakdown sheet\n`);

    } else {
      console.log('❌ VERIFICATION FAILED: Script Breakdown is still empty');
      console.log('   Please check Google Sheets permissions and try again\n');
      process.exit(1);
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error('\n📋 Stack Trace:');
    console.error(error.stack);
    console.error('\n💡 Troubleshooting:');
    console.error(`   1. Verify ${VIDEO_ID} exists in Master Sheet`);
    console.error(`   2. Check Google Sheets permissions`);
    console.error(`   3. Verify script content exists in Video Info sheet`);
    console.error(`   4. Run diagnostic: node tools/diagnose-missing-breakdowns.js ${VIDEO_ID}\n`);
    process.exit(1);
  }
}

/**
 * Extract keywords from sentence for video editor
 */
function extractKeywords(sentence) {
  const words = sentence.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  // Remove common words
  const stopWords = new Set([
    'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were',
    'will', 'would', 'could', 'should', 'about', 'your', 'their',
    'which', 'there', 'when', 'where', 'what', 'these', 'those'
  ]);

  const keywords = words.filter(word => !stopWords.has(word));

  // Return top 3-5 unique keywords
  return [...new Set(keywords)].slice(0, 5).join(', ');
}

// Run the fix
fixScriptBreakdown().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
