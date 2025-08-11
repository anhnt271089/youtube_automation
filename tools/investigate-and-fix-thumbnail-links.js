#!/usr/bin/env node

/**
 * Google Drive Thumbnail Links Investigation and Fix Tool
 * 
 * This tool will:
 * 1. Check the actual Google Sheets data for VID-0001
 * 2. Examine the Google Drive folder structure 
 * 3. Verify if thumbnail files actually exist
 * 4. Re-generate and properly upload thumbnails if needed
 * 5. Test that the final Google Drive links actually work
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config, validateConfig } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ThumbnailLinkInvestigator {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.googleDriveService = new GoogleDriveService();
    this.aiService = new AIService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
  }

  /**
   * Main investigation and fix process
   */
  async investigate() {
    try {
      logger.info('🔍 Starting Google Drive Thumbnail Links Investigation...');
      console.log('\n=== GOOGLE DRIVE THUMBNAIL LINKS INVESTIGATION ===\n');

      // Validate configuration
      validateConfig();

      // Step 1: Check VID-0001 data in Google Sheets
      logger.info('📊 Step 1: Checking VID-0001 data in Google Sheets...');
      const videoDetails = await this.checkVideoInSheets('VID-0001');
      
      if (!videoDetails) {
        throw new Error('VID-0001 not found in Google Sheets');
      }

      console.log('\n📊 VID-0001 Google Sheets Data:');
      console.log(`   Title: ${videoDetails.title}`);
      console.log(`   Status: ${videoDetails.status}`);
      console.log(`   Script Approved: ${videoDetails.scriptApproved}`);
      console.log(`   Drive Folder: ${videoDetails.driveFolder || 'NOT SET'}`);
      console.log(`   Detail Workbook: ${videoDetails.detailWorkbookUrl || 'NOT SET'}`);

      // Step 2: Check Google Drive folder structure
      logger.info('🗂️ Step 2: Investigating Google Drive folder structure...');
      const folderStructure = await this.checkDriveFolderStructure(videoDetails);
      console.log('\n🗂️ Google Drive Folder Structure:');
      this.displayFolderStructure(folderStructure);

      // Step 3: Check for existing thumbnail files
      logger.info('🖼️ Step 3: Checking for existing thumbnail files...');
      const existingThumbnails = await this.checkExistingThumbnailFiles(folderStructure);
      console.log('\n🖼️ Existing Thumbnail Files:');
      this.displayExistingThumbnails(existingThumbnails);

      // Step 4: Test thumbnail links if they exist
      let linkTests = null;
      if (existingThumbnails.thumbnails.length > 0) {
        logger.info('🔗 Step 4: Testing existing thumbnail links...');
        linkTests = await this.testThumbnailLinks(existingThumbnails.thumbnails);
        console.log('\n🔗 Thumbnail Link Test Results:');
        this.displayLinkTestResults(linkTests);
      }

      // Step 5: Generate missing or broken thumbnails
      logger.info('🎨 Step 5: Checking if thumbnail generation is needed...');
      const needsRegeneration = this.determineThumbnailNeed(existingThumbnails, linkTests);
      
      if (needsRegeneration.needed) {
        console.log(`\n🎨 Thumbnail Generation Needed: ${needsRegeneration.reason}`);
        await this.regenerateThumbnails(videoDetails, folderStructure);
      } else {
        console.log('\n✅ Thumbnails are working correctly - No action needed');
      }

      // Step 6: Final verification
      logger.info('✅ Step 6: Final verification...');
      await this.finalVerification('VID-0001');

      console.log('\n🎉 Investigation and fix completed successfully!');
      
    } catch (error) {
      logger.error('❌ Investigation failed:', error);
      console.error(`\n❌ ERROR: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Check video details in Google Sheets
   */
  async checkVideoInSheets(videoId) {
    try {
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      
      if (!videoDetails) {
        logger.error(`Video ${videoId} not found in Google Sheets`);
        return null;
      }

      return videoDetails;
    } catch (error) {
      logger.error(`Failed to get video details for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Check Google Drive folder structure
   */
  async checkDriveFolderStructure(videoDetails) {
    const structure = {
      mainFolder: null,
      thumbnailFolder: null,
      error: null
    };

    try {
      // Check if drive folder URL exists and is valid
      if (videoDetails.driveFolder) {
        const folderIdMatch = videoDetails.driveFolder.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        
        if (folderIdMatch) {
          const folderId = folderIdMatch[1];
          
          try {
            // Verify main folder exists
            const folderInfo = await this.googleDriveService.drive.files.get({
              fileId: folderId,
              fields: 'id, name, webViewLink, parents'
            });

            structure.mainFolder = {
              id: folderInfo.data.id,
              name: folderInfo.data.name,
              url: folderInfo.data.webViewLink,
              exists: true
            };

            // Look for "Generated Thumbnails" subfolder
            const subfolders = await this.googleDriveService.drive.files.list({
              q: `parents in '${folderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: 'files(id, name, webViewLink)'
            });

            const thumbnailFolder = subfolders.data.files.find(folder => 
              folder.name === 'Generated Thumbnails'
            );

            if (thumbnailFolder) {
              structure.thumbnailFolder = {
                id: thumbnailFolder.id,
                name: thumbnailFolder.name,
                url: thumbnailFolder.webViewLink,
                exists: true
              };
            } else {
              structure.thumbnailFolder = {
                exists: false,
                reason: 'Generated Thumbnails folder not found'
              };
            }

          } catch (folderError) {
            structure.mainFolder = {
              exists: false,
              error: folderError.message,
              invalidUrl: videoDetails.driveFolder
            };
          }
        } else {
          structure.mainFolder = {
            exists: false,
            error: 'Invalid folder URL format',
            invalidUrl: videoDetails.driveFolder
          };
        }
      } else {
        structure.mainFolder = {
          exists: false,
          reason: 'No drive folder URL in Google Sheets'
        };
      }

      // Search for folder by name pattern as fallback
      if (!structure.mainFolder?.exists) {
        const folderName = `(VID-0001) ${videoDetails.title}`;
        logger.info(`🔍 Searching for folder by name pattern: ${folderName}`);
        
        try {
          const searchResult = await this.searchForVideoFolder(folderName);
          if (searchResult) {
            structure.mainFolder = searchResult;
            
            // Update Google Sheets with found folder URL
            await this.googleSheetsService.updateVideoField('VID-0001', 'driveFolder', searchResult.url);
            logger.info('📝 Updated Google Sheets with found folder URL');
          }
        } catch (searchError) {
          logger.warn('Failed to search for folder by name:', searchError.message);
        }
      }

    } catch (error) {
      structure.error = error.message;
      logger.error('Error checking drive folder structure:', error);
    }

    return structure;
  }

  /**
   * Search for video folder by name pattern
   */
  async searchForVideoFolder(folderName) {
    try {
      // Try different parent folder configurations
      const possibleParents = [
        config.google.videosRootFolderId,
        config.google.driveFolderId
      ].filter(id => id);

      for (const parentId of possibleParents) {
        const response = await this.googleDriveService.drive.files.list({
          q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentId}' and trashed=false`,
          fields: 'files(id, name, webViewLink)'
        });

        if (response.data.files.length > 0) {
          const folder = response.data.files[0];
          return {
            id: folder.id,
            name: folder.name,
            url: folder.webViewLink,
            exists: true,
            foundBy: 'name_search'
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error searching for video folder:', error);
      return null;
    }
  }

  /**
   * Check for existing thumbnail files
   */
  async checkExistingThumbnailFiles(folderStructure) {
    const result = {
      thumbnails: [],
      count: 0,
      error: null
    };

    try {
      if (!folderStructure.thumbnailFolder?.exists) {
        result.error = 'No thumbnail folder found';
        return result;
      }

      const files = await this.googleDriveService.drive.files.list({
        q: `parents in '${folderStructure.thumbnailFolder.id}' and (name contains 'thumbnail' or mimeType contains 'image') and trashed=false`,
        fields: 'files(id, name, webViewLink, webContentLink, size, createdTime, mimeType)'
      });

      result.thumbnails = files.data.files.map(file => ({
        id: file.id,
        name: file.name,
        viewLink: file.webViewLink,
        directLink: `https://drive.google.com/uc?id=${file.id}`,
        downloadLink: file.webContentLink,
        size: file.size,
        createdTime: file.createdTime,
        mimeType: file.mimeType
      }));

      result.count = result.thumbnails.length;

    } catch (error) {
      result.error = error.message;
      logger.error('Error checking existing thumbnail files:', error);
    }

    return result;
  }

  /**
   * Test thumbnail links to see if they're accessible
   */
  async testThumbnailLinks(thumbnails) {
    const results = [];

    for (const thumbnail of thumbnails) {
      const test = {
        fileName: thumbnail.name,
        fileId: thumbnail.id,
        tests: {}
      };

      // Test different URL formats
      const urlsToTest = [
        { name: 'viewLink', url: thumbnail.viewLink },
        { name: 'directLink', url: thumbnail.directLink },
        { name: 'downloadLink', url: thumbnail.downloadLink }
      ];

      for (const urlTest of urlsToTest) {
        try {
          const axios = (await import('axios')).default;
          const response = await axios.head(urlTest.url, { 
            timeout: 10000,
            validateStatus: (status) => status < 500 // Accept redirects
          });
          
          test.tests[urlTest.name] = {
            status: 'working',
            httpStatus: response.status,
            contentType: response.headers['content-type']
          };
        } catch (error) {
          test.tests[urlTest.name] = {
            status: 'broken',
            error: error.message,
            httpStatus: error.response?.status
          };
        }
      }

      results.push(test);
    }

    return results;
  }

  /**
   * Determine if thumbnail generation is needed
   */
  determineThumbnailNeed(existingThumbnails, linkTests) {
    // No thumbnails exist
    if (existingThumbnails.count === 0) {
      return {
        needed: true,
        reason: 'No thumbnail files found'
      };
    }

    // Check if any links are working
    let workingLinks = 0;
    if (linkTests) {
      for (const test of linkTests) {
        if (test.tests.directLink?.status === 'working') {
          workingLinks++;
        }
      }
    }

    if (workingLinks === 0) {
      return {
        needed: true,
        reason: 'All thumbnail links are broken'
      };
    }

    if (workingLinks < 2) {
      return {
        needed: true,
        reason: `Only ${workingLinks}/2 thumbnails are working`
      };
    }

    return {
      needed: false,
      reason: 'All thumbnails are working correctly'
    };
  }

  /**
   * Regenerate thumbnails
   */
  async regenerateThumbnails(videoDetails, folderStructure) {
    try {
      logger.info('🎨 Starting thumbnail regeneration...');
      
      // Prepare video data for thumbnail generation
      const videoData = {
        title: videoDetails.title,
        youtubeUrl: videoDetails.youtubeUrl,
        videoId: videoDetails.youtubeVideoId,
        // Try to get script content from detail workbook
        transcriptText: null,
        optimizedScript: null
      };

      // Get script content if available
      try {
        if (videoDetails.detailWorkbookUrl) {
          const scriptContent = await this.googleSheetsService.getExistingScriptContent('VID-0001');
          if (scriptContent && scriptContent.cleanVoiceScript) {
            videoData.optimizedScript = scriptContent.cleanVoiceScript;
            logger.info('✅ Found existing script content for thumbnail generation');
          }
        }
      } catch (scriptError) {
        logger.warn('Could not get script content, using title only:', scriptError.message);
      }

      // Check for stored thumbnail concepts
      let storedConcepts = null;
      try {
        storedConcepts = await this.googleSheetsService.getStoredThumbnailConcepts('VID-0001');
        if (storedConcepts) {
          logger.info(`📋 Found stored thumbnail concepts (${storedConcepts.length} chars)`);
        }
      } catch (conceptError) {
        logger.warn('Could not get stored concepts:', conceptError.message);
      }

      // Generate and upload thumbnails
      const result = await this.thumbnailService.processVideoThumbnails(
        videoData,
        'VID-0001',
        true, // Force regeneration
        this.googleSheetsService,
        storedConcepts
      );

      console.log('\n🎨 Thumbnail Generation Results:');
      console.log(`   Generated: ${result.generated}`);
      console.log(`   Uploaded: ${result.uploaded}`);
      console.log(`   Failed: ${result.failed}`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.driveFolder) {
        console.log(`   Drive Folder: ${result.driveFolder}`);
      }

      if (result.thumbnails) {
        console.log('\n📎 Generated Thumbnails:');
        console.log(`   Style 1 (${result.thumbnails.thumbnail1.style}): ${result.thumbnails.thumbnail1.fileName}`);
        if (result.thumbnails.thumbnail1.upload?.directLink) {
          console.log(`     Direct Link: ${result.thumbnails.thumbnail1.upload.directLink}`);
        }
        
        console.log(`   Style 2 (${result.thumbnails.thumbnail2.style}): ${result.thumbnails.thumbnail2.fileName}`);
        if (result.thumbnails.thumbnail2.upload?.directLink) {
          console.log(`     Direct Link: ${result.thumbnails.thumbnail2.upload.directLink}`);
        }
      }

    } catch (error) {
      logger.error('❌ Thumbnail regeneration failed:', error);
      console.error(`\n❌ Thumbnail regeneration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Final verification of thumbnail links
   */
  async finalVerification(videoId) {
    try {
      logger.info('🔍 Performing final verification...');
      
      // Re-check the folder structure
      const videoDetails = await this.googleSheetsService.getVideoDetails(videoId);
      const folderStructure = await this.checkDriveFolderStructure(videoDetails);
      const existingThumbnails = await this.checkExistingThumbnailFiles(folderStructure);
      
      if (existingThumbnails.count > 0) {
        const linkTests = await this.testThumbnailLinks(existingThumbnails.thumbnails);
        
        console.log('\n✅ Final Verification Results:');
        console.log(`   Total Thumbnails: ${existingThumbnails.count}`);
        
        let workingCount = 0;
        for (const test of linkTests) {
          if (test.tests.directLink?.status === 'working') {
            workingCount++;
            console.log(`   ✅ ${test.fileName}: Working`);
            console.log(`      Direct Link: https://drive.google.com/uc?id=${test.fileId}`);
          } else {
            console.log(`   ❌ ${test.fileName}: Broken`);
          }
        }
        
        console.log(`\n📊 Summary: ${workingCount}/${existingThumbnails.count} thumbnails working`);
        
        if (workingCount === existingThumbnails.count && workingCount >= 2) {
          console.log('🎉 All thumbnail links are working correctly!');
        } else {
          console.log('⚠️ Some thumbnail links may still have issues');
        }
      } else {
        console.log('\n❌ No thumbnails found after regeneration');
      }
      
    } catch (error) {
      logger.error('Final verification failed:', error);
      console.error(`\n⚠️ Final verification failed: ${error.message}`);
    }
  }

  /**
   * Display helper methods
   */
  displayFolderStructure(structure) {
    if (structure.mainFolder?.exists) {
      console.log(`   ✅ Main Folder: ${structure.mainFolder.name}`);
      console.log(`      ID: ${structure.mainFolder.id}`);
      console.log(`      URL: ${structure.mainFolder.url}`);
    } else {
      console.log(`   ❌ Main Folder: ${structure.mainFolder?.error || structure.mainFolder?.reason || 'Not found'}`);
      if (structure.mainFolder?.invalidUrl) {
        console.log(`      Invalid URL: ${structure.mainFolder.invalidUrl}`);
      }
    }

    if (structure.thumbnailFolder?.exists) {
      console.log(`   ✅ Thumbnail Folder: ${structure.thumbnailFolder.name}`);
      console.log(`      ID: ${structure.thumbnailFolder.id}`);
      console.log(`      URL: ${structure.thumbnailFolder.url}`);
    } else {
      console.log(`   ❌ Thumbnail Folder: ${structure.thumbnailFolder?.reason || 'Not found'}`);
    }
  }

  displayExistingThumbnails(thumbnails) {
    if (thumbnails.count === 0) {
      console.log(`   ❌ No thumbnail files found`);
      if (thumbnails.error) {
        console.log(`      Error: ${thumbnails.error}`);
      }
    } else {
      console.log(`   ✅ Found ${thumbnails.count} thumbnail files:`);
      thumbnails.thumbnails.forEach((thumb, index) => {
        console.log(`   ${index + 1}. ${thumb.name}`);
        console.log(`      ID: ${thumb.id}`);
        console.log(`      Size: ${thumb.size} bytes`);
        console.log(`      Direct Link: ${thumb.directLink}`);
        console.log(`      Created: ${thumb.createdTime}`);
      });
    }
  }

  displayLinkTestResults(linkTests) {
    linkTests.forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.fileName}:`);
      
      Object.entries(test.tests).forEach(([linkType, result]) => {
        if (result.status === 'working') {
          console.log(`      ✅ ${linkType}: Working (${result.httpStatus})`);
        } else {
          console.log(`      ❌ ${linkType}: Broken (${result.httpStatus || 'N/A'}) - ${result.error}`);
        }
      });
      console.log('');
    });
  }
}

// Main execution
async function main() {
  const investigator = new ThumbnailLinkInvestigator();
  await investigator.investigate();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Thumbnail investigation failed:', error);
    process.exit(1);
  });
}

export default ThumbnailLinkInvestigator;