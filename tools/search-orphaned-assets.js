#!/usr/bin/env node

/**
 * Search for Orphaned Assets
 * Find Drive folders and workbooks that might belong to VID-0008 and VID-0013
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class OrphanedAssetsSearcher {
  constructor() {
    // Setup Google Drive and Sheets API
    const auth = new google.auth.OAuth2({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri
    });

    auth.setCredentials({
      access_token: config.google.accessToken,
      refresh_token: config.google.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Search for folders and workbooks that might belong to specific videos
   */
  async searchOrphanedAssets(videoIds) {
    logger.info('🔍 Searching for orphaned assets...');
    
    const results = {
      videoIds,
      potentialFolders: [],
      potentialWorkbooks: [],
      recommendations: []
    };

    for (const videoId of videoIds) {
      logger.info(`\n📁 Searching for assets related to ${videoId}...`);
      
      // Search for folders containing the video ID
      await this.searchFolders(videoId, results);
      
      // Search for workbooks containing the video ID
      await this.searchWorkbooks(videoId, results);
      
      // Search by title keywords if we have video data
      await this.searchByTitle(videoId, results);
    }
    
    // Generate recommendations
    this.generateRecommendations(results);
    
    return results;
  }

  /**
   * Search for folders that might belong to the video
   */
  async searchFolders(videoId, results) {
    try {
      // Search for folders with video ID in name
      const folderQuery = `name contains '${videoId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const folderResponse = await this.drive.files.list({
        q: folderQuery,
        fields: 'files(id, name, webViewLink, parents, createdTime, modifiedTime)',
        orderBy: 'createdTime desc'
      });

      const folders = folderResponse.data.files || [];
      logger.info(`   📂 Found ${folders.length} folders containing "${videoId}"`);

      for (const folder of folders) {
        // Check if folder is in the videos root folder
        const isInVideosRoot = folder.parents?.includes(config.google.videosRootFolderId);
        
        results.potentialFolders.push({
          videoId,
          folder: {
            id: folder.id,
            name: folder.name,
            url: `https://drive.google.com/drive/folders/${folder.id}`,
            webViewLink: folder.webViewLink,
            createdTime: folder.createdTime,
            modifiedTime: folder.modifiedTime,
            isInVideosRoot,
            parents: folder.parents
          },
          confidence: this.calculateFolderConfidence(videoId, folder)
        });

        logger.info(`      📁 ${folder.name} (Created: ${folder.createdTime})`);
        logger.info(`         🔗 ${folder.webViewLink}`);
        logger.info(`         📍 In Videos Root: ${isInVideosRoot}`);
      }

    } catch (error) {
      logger.error(`Error searching folders for ${videoId}:`, error.message);
    }
  }

  /**
   * Search for workbooks that might belong to the video
   */
  async searchWorkbooks(videoId, results) {
    try {
      // Search for spreadsheets with video ID in name
      const workbookQuery = `name contains '${videoId}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
      const workbookResponse = await this.drive.files.list({
        q: workbookQuery,
        fields: 'files(id, name, webViewLink, parents, createdTime, modifiedTime)',
        orderBy: 'createdTime desc'
      });

      const workbooks = workbookResponse.data.files || [];
      logger.info(`   📊 Found ${workbooks.length} workbooks containing "${videoId}"`);

      for (const workbook of workbooks) {
        results.potentialWorkbooks.push({
          videoId,
          workbook: {
            id: workbook.id,
            name: workbook.name,
            url: `https://docs.google.com/spreadsheets/d/${workbook.id}`,
            webViewLink: workbook.webViewLink,
            createdTime: workbook.createdTime,
            modifiedTime: workbook.modifiedTime,
            parents: workbook.parents
          },
          confidence: this.calculateWorkbookConfidence(videoId, workbook)
        });

        logger.info(`      📋 ${workbook.name} (Created: ${workbook.createdTime})`);
        logger.info(`         🔗 ${workbook.webViewLink}`);

        // Check if workbook has the expected sheets
        try {
          const sheetsResponse = await this.sheets.spreadsheets.get({
            spreadsheetId: workbook.id
          });
          
          const sheetNames = sheetsResponse.data.sheets?.map(s => s.properties.title) || [];
          logger.info(`         📄 Sheets: ${sheetNames.join(', ')}`);
          
          // Check if it has the expected structure
          const expectedSheets = ['Video Info', 'Script Breakdown', 'Analytics'];
          const hasExpectedStructure = expectedSheets.every(sheet => sheetNames.includes(sheet));
          logger.info(`         ✅ Has Expected Structure: ${hasExpectedStructure}`);

        } catch (sheetsError) {
          logger.warn(`         ❌ Cannot access workbook sheets: ${sheetsError.message}`);
        }
      }

    } catch (error) {
      logger.error(`Error searching workbooks for ${videoId}:`, error.message);
    }
  }

  /**
   * Search by title keywords
   */
  async searchByTitle(videoId, results) {
    try {
      // Get video titles for keyword search
      const videoTitles = {
        'VID-0008': 'How to Control your Brain',
        'VID-0013': 'The Art of Being Unbothered By Opinions'
      };

      const title = videoTitles[videoId];
      if (!title) return;

      // Extract key words from title for search
      const keywords = title.split(' ').filter(word => 
        word.length > 3 && 
        !['How', 'to', 'The', 'Art', 'of', 'By', 'your', 'them'].includes(word)
      );

      logger.info(`   🔍 Searching by title keywords: ${keywords.join(', ')}`);

      for (const keyword of keywords.slice(0, 2)) { // Search top 2 keywords
        // Search folders by keyword
        const folderKeywordQuery = `name contains '${keyword}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const folderResponse = await this.drive.files.list({
          q: folderKeywordQuery,
          fields: 'files(id, name, webViewLink, parents, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 5 // Limit results
        });

        const folders = folderResponse.data.files || [];
        if (folders.length > 0) {
          logger.info(`      📂 Keyword "${keyword}" found in ${folders.length} folders:`);
          folders.forEach(folder => {
            logger.info(`         📁 ${folder.name}`);
            // Add to potential if not already found
            const alreadyFound = results.potentialFolders.some(pf => pf.folder.id === folder.id);
            if (!alreadyFound) {
              results.potentialFolders.push({
                videoId,
                folder: {
                  id: folder.id,
                  name: folder.name,
                  url: `https://drive.google.com/drive/folders/${folder.id}`,
                  webViewLink: folder.webViewLink,
                  createdTime: folder.createdTime,
                  parents: folder.parents
                },
                confidence: this.calculateFolderConfidenceByKeyword(keyword, folder.name),
                foundBy: `keyword: ${keyword}`
              });
            }
          });
        }

        // Search workbooks by keyword
        const workbookKeywordQuery = `name contains '${keyword}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
        const workbookResponse = await this.drive.files.list({
          q: workbookKeywordQuery,
          fields: 'files(id, name, webViewLink, parents, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 5 // Limit results
        });

        const workbooks = workbookResponse.data.files || [];
        if (workbooks.length > 0) {
          logger.info(`      📊 Keyword "${keyword}" found in ${workbooks.length} workbooks:`);
          workbooks.forEach(workbook => {
            logger.info(`         📋 ${workbook.name}`);
            // Add to potential if not already found
            const alreadyFound = results.potentialWorkbooks.some(pw => pw.workbook.id === workbook.id);
            if (!alreadyFound) {
              results.potentialWorkbooks.push({
                videoId,
                workbook: {
                  id: workbook.id,
                  name: workbook.name,
                  url: `https://docs.google.com/spreadsheets/d/${workbook.id}`,
                  webViewLink: workbook.webViewLink,
                  createdTime: workbook.createdTime,
                  parents: workbook.parents
                },
                confidence: this.calculateWorkbookConfidenceByKeyword(keyword, workbook.name),
                foundBy: `keyword: ${keyword}`
              });
            }
          });
        }
      }

    } catch (error) {
      logger.error(`Error searching by title for ${videoId}:`, error.message);
    }
  }

  /**
   * Calculate confidence score for folder match
   */
  calculateFolderConfidence(videoId, folder) {
    let confidence = 0;
    
    // Exact video ID match
    if (folder.name.includes(videoId)) confidence += 50;
    
    // In correct parent folder
    if (folder.parents?.includes(config.google.videosRootFolderId)) confidence += 30;
    
    // Name format matches expected pattern (VID-XXXX) Title
    if (folder.name.match(/^\(VID-\d{4}\)/)) confidence += 20;
    
    return Math.min(confidence, 100);
  }

  /**
   * Calculate confidence score for workbook match
   */
  calculateWorkbookConfidence(videoId, workbook) {
    let confidence = 0;
    
    // Exact video ID match
    if (workbook.name.includes(videoId)) confidence += 50;
    
    // Contains "Video Detail" or similar
    if (workbook.name.toLowerCase().includes('video detail')) confidence += 20;
    if (workbook.name.toLowerCase().includes('detail')) confidence += 15;
    
    // Name format matches expected pattern
    if (workbook.name.match(/^\(VID-\d{4}\)/)) confidence += 15;
    
    return Math.min(confidence, 100);
  }

  /**
   * Calculate confidence by keyword match
   */
  calculateFolderConfidenceByKeyword(keyword, name) {
    const keywordLength = keyword.length;
    if (keywordLength > 6) return 30; // Longer keywords are more specific
    if (keywordLength > 4) return 20;
    return 10;
  }

  calculateWorkbookConfidenceByKeyword(keyword, name) {
    const keywordLength = keyword.length;
    if (keywordLength > 6) return 25;
    if (keywordLength > 4) return 15;
    return 5;
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations(results) {
    logger.info('\n📋 GENERATING RECOMMENDATIONS...');
    
    // Sort by confidence
    results.potentialFolders.sort((a, b) => b.confidence - a.confidence);
    results.potentialWorkbooks.sort((a, b) => b.confidence - a.confidence);

    for (const videoId of results.videoIds) {
      const videoFolders = results.potentialFolders.filter(pf => pf.videoId === videoId);
      const videoWorkbooks = results.potentialWorkbooks.filter(pw => pw.videoId === videoId);

      logger.info(`\n🎯 ${videoId} Recommendations:`);

      // Folder recommendations
      if (videoFolders.length > 0) {
        const bestFolder = videoFolders[0];
        if (bestFolder.confidence >= 50) {
          results.recommendations.push({
            videoId,
            type: 'LINK_FOLDER',
            priority: 'HIGH',
            action: `Link existing folder to ${videoId}`,
            asset: bestFolder.folder,
            confidence: bestFolder.confidence,
            steps: [
              `Update master sheet Drive Folder URL to: ${bestFolder.folder.url}`,
              'Verify folder contains expected content',
              'Test folder accessibility'
            ]
          });
          logger.info(`   ✅ HIGH CONFIDENCE FOLDER MATCH (${bestFolder.confidence}%): ${bestFolder.folder.name}`);
        } else {
          results.recommendations.push({
            videoId,
            type: 'VERIFY_FOLDER',
            priority: 'MEDIUM',
            action: `Manually verify potential folder for ${videoId}`,
            asset: bestFolder.folder,
            confidence: bestFolder.confidence,
            steps: [
              'Manually inspect folder contents',
              'Check if folder structure matches video requirements',
              'Consider renaming folder if it matches'
            ]
          });
          logger.info(`   ⚠️ POSSIBLE FOLDER MATCH (${bestFolder.confidence}%): ${bestFolder.folder.name}`);
        }
      } else {
        results.recommendations.push({
          videoId,
          type: 'CREATE_FOLDER',
          priority: 'HIGH',
          action: `Create new folder for ${videoId}`,
          steps: [
            'Run workflow to create new Drive folder',
            'Create folder structure for video assets',
            'Update master sheet with new folder URL'
          ]
        });
        logger.info(`   🆕 CREATE NEW FOLDER - No potential matches found`);
      }

      // Workbook recommendations
      if (videoWorkbooks.length > 0) {
        const bestWorkbook = videoWorkbooks[0];
        if (bestWorkbook.confidence >= 50) {
          results.recommendations.push({
            videoId,
            type: 'LINK_WORKBOOK',
            priority: 'HIGH',
            action: `Link existing workbook to ${videoId}`,
            asset: bestWorkbook.workbook,
            confidence: bestWorkbook.confidence,
            steps: [
              `Update master sheet Detail Workbook URL to: ${bestWorkbook.workbook.url}`,
              'Verify workbook has expected sheets (Video Info, Script Breakdown, Analytics)',
              'Test workbook accessibility'
            ]
          });
          logger.info(`   ✅ HIGH CONFIDENCE WORKBOOK MATCH (${bestWorkbook.confidence}%): ${bestWorkbook.workbook.name}`);
        } else {
          results.recommendations.push({
            videoId,
            type: 'VERIFY_WORKBOOK',
            priority: 'MEDIUM',
            action: `Manually verify potential workbook for ${videoId}`,
            asset: bestWorkbook.workbook,
            confidence: bestWorkbook.confidence,
            steps: [
              'Manually inspect workbook structure',
              'Check if workbook contains video-specific data',
              'Consider renaming workbook if it matches'
            ]
          });
          logger.info(`   ⚠️ POSSIBLE WORKBOOK MATCH (${bestWorkbook.confidence}%): ${bestWorkbook.workbook.name}`);
        }
      } else {
        results.recommendations.push({
          videoId,
          type: 'CREATE_WORKBOOK',
          priority: 'HIGH',
          action: `Create new workbook for ${videoId}`,
          steps: [
            'Run workflow to create new detail workbook from template',
            'Populate workbook with video data',
            'Update master sheet with new workbook URL'
          ]
        });
        logger.info(`   🆕 CREATE NEW WORKBOOK - No potential matches found`);
      }
    }

    logger.info(`\n📊 SUMMARY: Found ${results.potentialFolders.length} potential folders, ${results.potentialWorkbooks.length} potential workbooks`);
  }
}

// Main execution
async function main() {
  try {
    const searcher = new OrphanedAssetsSearcher();
    const videoIds = ['VID-0008', 'VID-0013'];
    
    const results = await searcher.searchOrphanedAssets(videoIds);
    
    // Save results
    const fs = await import('fs').then(m => m.promises);
    const resultsFile = `orphaned-assets-results-${Date.now()}.json`;
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    logger.info(`\n📁 Search results saved to: ${resultsFile}`);
    
  } catch (error) {
    logger.error('❌ Search failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default OrphanedAssetsSearcher;