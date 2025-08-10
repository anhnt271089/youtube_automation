#!/usr/bin/env node

import GoogleDriveService from '../src/services/googleDriveService.js';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class ThumbnailFolderFinder {
  constructor() {
    this.driveService = new GoogleDriveService();
  }

  async findAllThumbnailFolders() {
    logger.info('🔍 Searching for all thumbnail-related folders...');
    
    try {
      // Search for folders with "thumbnail" in the name
      const response = await this.driveService.drive.files.list({
        q: `name contains 'thumbnail' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, webViewLink, parents, createdTime, modifiedTime)'
      });
      
      const thumbnailFolders = response.data.files || [];
      logger.info(`📁 Found ${thumbnailFolders.length} folders with 'thumbnail' in name:`);
      
      for (const folder of thumbnailFolders) {
        logger.info(`\n📂 ${folder.name}`);
        logger.info(`  ID: ${folder.id}`);
        logger.info(`  URL: ${folder.webViewLink}`);
        logger.info(`  Created: ${folder.createdTime}`);
        logger.info(`  Modified: ${folder.modifiedTime}`);
        
        // Check parent folder info
        if (folder.parents && folder.parents.length > 0) {
          try {
            const parent = await this.driveService.drive.files.get({
              fileId: folder.parents[0],
              fields: 'name, webViewLink'
            });
            logger.info(`  Parent: ${parent.data.name}`);
            logger.info(`  Parent URL: ${parent.data.webViewLink}`);
          } catch (parentError) {
            logger.warn(`  Parent info unavailable: ${parentError.message}`);
          }
        }
        
        // Check contents of thumbnail folder
        try {
          const contents = await this.driveService.drive.files.list({
            q: `parents in '${folder.id}' and trashed=false`,
            fields: 'files(id, name, mimeType, size)'
          });
          
          const files = contents.data.files || [];
          const images = files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
          logger.info(`  Contents: ${files.length} files, ${images.length} images`);
          
          images.forEach(img => {
            logger.info(`    🖼️  ${img.name} (${img.size} bytes)`);
          });
          
        } catch (contentsError) {
          logger.warn(`  Could not list contents: ${contentsError.message}`);
        }
      }
      
      // Also search for folders named exactly "Generated Thumbnails"
      logger.info(`\n🔍 Searching for "Generated Thumbnails" folders...`);
      const generatedResponse = await this.driveService.drive.files.list({
        q: `name='Generated Thumbnails' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, webViewLink, parents, createdTime)'
      });
      
      const generatedFolders = generatedResponse.data.files || [];
      logger.info(`📁 Found ${generatedFolders.length} "Generated Thumbnails" folders:`);
      
      for (const folder of generatedFolders) {
        logger.info(`\n📂 Generated Thumbnails`);
        logger.info(`  ID: ${folder.id}`);
        logger.info(`  URL: ${folder.webViewLink}`);
        logger.info(`  Created: ${folder.createdTime}`);
        
        // Check parent folder info to see if it's in a video folder
        if (folder.parents && folder.parents.length > 0) {
          try {
            const parent = await this.driveService.drive.files.get({
              fileId: folder.parents[0],
              fields: 'name, webViewLink'
            });
            logger.info(`  Parent: ${parent.data.name}`);
            
            // Check if parent looks like a video folder
            const videoIdMatch = parent.data.name.match(/\(VID-\d+\)/);
            if (videoIdMatch) {
              logger.info(`  ✅ Located in video folder for ${videoIdMatch[0]}`);
            } else {
              logger.warn(`  ❗ Parent doesn't look like video folder: ${parent.data.name}`);
            }
          } catch (parentError) {
            logger.warn(`  Parent info unavailable: ${parentError.message}`);
          }
        }
        
        // Check contents
        try {
          const contents = await this.driveService.drive.files.list({
            q: `parents in '${folder.id}' and trashed=false`,
            fields: 'files(id, name, mimeType, size, createdTime)'
          });
          
          const files = contents.data.files || [];
          const images = files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
          logger.info(`  Contents: ${files.length} files, ${images.length} images`);
          
          images.forEach(img => {
            logger.info(`    🖼️  ${img.name} (${Math.round(img.size/1024)}KB) - ${img.createdTime}`);
          });
          
        } catch (contentsError) {
          logger.warn(`  Could not list contents: ${contentsError.message}`);
        }
      }
      
      // Search for image files with "thumbnail" in name that might be in wrong locations
      logger.info(`\n🔍 Searching for thumbnail image files...`);
      const imageResponse = await this.driveService.drive.files.list({
        q: `name contains 'thumbnail' and (mimeType contains 'image/' or name contains '.jpg' or name contains '.png') and trashed=false`,
        fields: 'files(id, name, parents, webViewLink, createdTime, size)'
      });
      
      const thumbnailImages = imageResponse.data.files || [];
      logger.info(`🖼️  Found ${thumbnailImages.length} thumbnail image files:`);
      
      for (const image of thumbnailImages.slice(0, 10)) { // Show first 10
        logger.info(`\n🖼️  ${image.name}`);
        logger.info(`  Size: ${Math.round(image.size/1024)}KB`);
        logger.info(`  Created: ${image.createdTime}`);
        
        // Check what folder this image is in
        if (image.parents && image.parents.length > 0) {
          try {
            const parent = await this.driveService.drive.files.get({
              fileId: image.parents[0],
              fields: 'name, webViewLink'
            });
            logger.info(`  Located in: ${parent.data.name}`);
            
            // Check if it's in the wrong location
            const videoIdMatch = parent.data.name.match(/\(VID-\d+\)/);
            if (videoIdMatch && !parent.data.name.includes('Generated Thumbnails')) {
              logger.warn(`  ❗ May be in wrong location - should be in Generated Thumbnails subfolder`);
            }
          } catch (parentError) {
            logger.warn(`  Parent info unavailable: ${parentError.message}`);
          }
        }
      }
      
      if (thumbnailImages.length > 10) {
        logger.info(`... and ${thumbnailImages.length - 10} more thumbnail images`);
      }
      
    } catch (error) {
      logger.error('❌ Search failed:', error);
    }
  }

  async run() {
    try {
      await this.findAllThumbnailFolders();
    } catch (error) {
      logger.error('❌ Fatal error:', error);
      process.exit(1);
    }
  }
}

const finder = new ThumbnailFolderFinder();
finder.run();