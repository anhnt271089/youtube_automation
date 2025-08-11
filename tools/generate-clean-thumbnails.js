#!/usr/bin/env node

import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class CleanThumbnailGenerator {
  constructor() {
    this.aiService = new AIService();
    this.driveService = new GoogleDriveService();
  }

  async generateCleanThumbnails() {
    console.log('🎨 Generating Clean Thumbnails for VID-0001');
    console.log('========================================\n');

    const cleanPrompts = [
      {
        name: 'Planning Success',
        prompt: `Create a compelling standalone image featuring a confident person with planning materials. ABSOLUTE REQUIREMENT: FULL CANVAS USAGE edge-to-edge with NO PADDING, NO BORDERS, NO EMPTY SPACE - content must completely fill entire image area. Show a person organizing charts and planning documents with a satisfied expression. Use HIGH-CONTRAST COLORS: warm lighting with professional blues and oranges. NO TEXT OVERLAYS OR WRITTEN CONTENT - pure visual storytelling only. Professional photography style with rich textures and inspiring workspace aesthetics. Focus on success through planning theme.`
      },
      {
        name: 'Achievement Moment', 
        prompt: `Create a compelling standalone image featuring a person celebrating achievement. ABSOLUTE REQUIREMENT: FULL CANVAS USAGE edge-to-edge with NO PADDING, NO BORDERS, NO EMPTY SPACE - content must completely fill entire image area. Show someone with arms raised in triumph with achievement symbols around them. Use HIGH-CONTRAST COLORS: energetic reds and golds for success psychology. NO TEXT OVERLAYS OR WRITTEN CONTENT - pure visual storytelling only. Professional portrait style with dynamic lighting and motivational appeal. Focus on breakthrough success theme.`
      }
    ];

    const results = [];

    for (let i = 0; i < cleanPrompts.length; i++) {
      const prompt = cleanPrompts[i];
      console.log(`📸 Generating: ${prompt.name}...`);

      try {
        // Generate image with DALL-E
        const imageResult = await this.aiService.generateImage(prompt.prompt, {
          size: '1792x1024',
          quality: 'hd',
          style: 'natural'
        });

        console.log(`✅ Generated: ${prompt.name}`);

        // Upload to Google Drive
        const fileName = `clean_thumbnail_${i + 1}.jpg`;
        const folderId = '12H4s1r1U4JRrbQzGmu_tGpCD1W6Yc487'; // VID-0001 thumbnails folder

        const uploadResult = await this.driveService.uploadImageFromUrl(
          imageResult.url,
          fileName,
          folderId
        );

        console.log(`📁 Uploaded: ${uploadResult.viewLink}`);

        results.push({
          name: prompt.name,
          fileName,
          driveLink: uploadResult.viewLink,
          directLink: `https://drive.google.com/uc?id=${uploadResult.fileId}`
        });

      } catch (error) {
        console.error(`❌ Failed to generate ${prompt.name}:`, error.message);
      }
    }

    console.log('\n🎯 CLEAN THUMBNAILS GENERATED:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}:`);
      console.log(`   Direct Link: ${result.directLink}`);
    });

    console.log('\n✅ Clean thumbnail generation completed!');
    console.log('These thumbnails have NO YouTube references, NO text, NO dimensions mentioned in prompts.');
    
    return results;
  }
}

// Run the generator
const generator = new CleanThumbnailGenerator();
generator.generateCleanThumbnails().catch(console.error);