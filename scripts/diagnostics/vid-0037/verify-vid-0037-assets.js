#!/usr/bin/env node

/**
 * Verify VID-0037 Assets in Google Drive
 * Checks that all asset URLs are valid and accessible
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';

const VIDEO_ID = 'VID-0037';

async function verifyAssets() {
  const sheetsService = new GoogleSheetsService();

  try {
    console.log('\n=== VID-0037 Asset Verification ===\n');

    // Get video details
    const videoDetails = await sheetsService.getVideoDetails(VIDEO_ID);
    console.log('📊 Master Sheet:');
    console.log(`   Status: ${videoDetails.status}`);
    console.log(`   Drive Folder: ${videoDetails.driveFolder || 'Not set'}`);

    // Get script breakdown
    const scriptBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    console.log('\n📝 Script Breakdown Assets:');
    console.log(`   Total Sentences: ${scriptBreakdown.length}`);

    // Analyze assets
    const withAssets = scriptBreakdown.filter(s => s.imageUrl && s.imageUrl.trim() !== '');
    const withoutAssets = scriptBreakdown.filter(s => !s.imageUrl || s.imageUrl.trim() === '');
    const videoAssets = withAssets.filter(s => s.imageUrl && s.imageUrl.includes('.mp4'));
    const photoAssets = withAssets.filter(s => s.imageUrl && (s.imageUrl.includes('.jpg') || s.imageUrl.includes('.jpeg') || s.imageUrl.includes('.png')));

    console.log(`   With Assets: ${withAssets.length}`);
    console.log(`   Without Assets: ${withoutAssets.length}`);
    console.log(`   Video Assets (.mp4): ${videoAssets.length}`);
    console.log(`   Photo Assets (.jpg/.jpeg/.png): ${photoAssets.length}`);

    // Check asset URL format
    const validUrls = withAssets.filter(s =>
      s.imageUrl.startsWith('http') &&
      (s.imageUrl.includes('drive.google.com') || s.imageUrl.includes('googleusercontent.com'))
    );

    const invalidUrls = withAssets.filter(s =>
      !s.imageUrl.startsWith('http') ||
      (!s.imageUrl.includes('drive.google.com') && !s.imageUrl.includes('googleusercontent.com'))
    );

    console.log('\n🔗 Asset URL Validation:');
    console.log(`   Valid Google Drive URLs: ${validUrls.length}`);
    console.log(`   Invalid/External URLs: ${invalidUrls.length}`);

    if (invalidUrls.length > 0) {
      console.log('\n⚠️  Invalid URLs found:');
      invalidUrls.slice(0, 5).forEach(s => {
        console.log(`   - Sentence ${s.sentenceNumber}: ${s.imageUrl.substring(0, 60)}...`);
      });
      if (invalidUrls.length > 5) {
        console.log(`   ... and ${invalidUrls.length - 5} more`);
      }
    }

    // Sample assets
    console.log('\n📦 Sample Assets:');
    const samples = withAssets.slice(0, 5);
    samples.forEach(s => {
      const type = s.imageUrl.includes('.mp4') ? '📹 Video' : '📸 Photo';
      console.log(`   ${type} S-${s.sentenceNumber}: ${s.status}`);
      console.log(`      URL: ${s.imageUrl.substring(0, 80)}...`);
    });

    // Final summary
    console.log('\n✨ Summary:');
    const completion = scriptBreakdown.length > 0
      ? Math.round((withAssets.length / scriptBreakdown.length) * 100)
      : 0;
    console.log(`   Asset Coverage: ${completion}% (${withAssets.length}/${scriptBreakdown.length})`);
    console.log(`   Master Status: ${videoDetails.status}`);
    console.log(`   All Assets Valid: ${invalidUrls.length === 0 ? '✅ Yes' : '❌ No'}`);

    if (completion === 100 && invalidUrls.length === 0 && videoDetails.status === 'Completed') {
      console.log('\n🎉 SUCCESS: All assets downloaded and verified!\n');
    } else {
      console.log('\n⚠️  WARNING: Some issues detected. Review details above.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAssets()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
