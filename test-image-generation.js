#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import AIService from './src/services/aiService.js';
import GoogleDriveService from './src/services/googleDriveService.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function testImageGeneration() {
  try {
    console.log('🎨 Testing Image Generation Pipeline...');
    
    const aiService = new AIService();
    const googleDriveService = new GoogleDriveService();
    
    // Sample image prompts derived from "The Art of Doing Anything Exceptionally Well" video
    const samplePrompts = [
      "A determined artist holding a paintbrush, surrounded by unfinished canvases, representing the journey of mastery and dedication",
      "An elderly Japanese master craftsman Hokusai working on a detailed painting at age 73, showing patience and expertise",
      "A montage showing repetitive practice - musician playing scales, athlete training, artist sketching the same subject multiple times",
      "A visual metaphor of excellence - a mountain path leading upward with milestones representing different levels of mastery",
      "A close-up of hands practicing the same basic movement over and over, with slight improvements visible in each attempt"
    ];
    
    console.log(`📝 Testing with ${samplePrompts.length} sample image prompts`);
    
    const generatedImages = [];
    
    // Test generating 3 images as per IMAGE_GENERATION_LIMIT=5 setting
    for (let i = 0; i < Math.min(3, samplePrompts.length); i++) {
      const prompt = samplePrompts[i];
      console.log(`\n🖼️  Generating image ${i + 1}:`);
      console.log(`   Prompt: ${prompt.substring(0, 80)}...`);
      
      try {
        // Generate image using DALL-E
        const imageResult = await aiService.generateImage(prompt);
        console.log(`   ✅ Image generated successfully: ${imageResult.url}`);
        
        // Download and save the image
        const imageResponse = await fetch(imageResult.url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const fileName = `test_image_${i + 1}.png`;
        const tempPath = path.join(__dirname, 'temp', fileName);
        
        await fs.writeFile(tempPath, Buffer.from(imageBuffer));
        console.log(`   📁 Image saved to: ${tempPath}`);
        
        // Test Google Drive upload
        console.log('   ☁️  Uploading to Google Drive...');
        const driveFile = await googleDriveService.uploadFile(
          tempPath,
          fileName,
          process.env.GOOGLE_DRIVE_FOLDER_ID || 'root',
          'image/png'
        );
        
        console.log(`   ✅ Uploaded to Google Drive: ${driveFile.webViewLink}`);
        
        generatedImages.push({
          prompt: prompt,
          originalUrl: imageResult.url,
          localPath: tempPath,
          driveUrl: driveFile.webViewLink,
          driveFileId: driveFile.id
        });
        
      } catch (error) {
        console.error(`   ❌ Error generating image ${i + 1}:`, error.message);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 Image Generation Summary:');
    console.log(`   Total prompts: ${samplePrompts.length}`);
    console.log(`   Attempted: 3`);
    console.log(`   Successfully generated: ${generatedImages.length}`);
    
    if (generatedImages.length > 0) {
      console.log('\n🎉 Generated Images:');
      generatedImages.forEach((img, index) => {
        console.log(`   ${index + 1}. Local: ${img.localPath}`);
        console.log(`      Drive: ${img.driveUrl}`);
      });
    }
    
    return {
      successful: generatedImages.length,
      total: 3,
      images: generatedImages
    };
    
  } catch (error) {
    console.error('❌ Error in image generation test:', error);
    throw error;
  }
}

// Run the test
testImageGeneration()
  .then((result) => {
    console.log(`\n✅ Image generation test completed! Generated ${result.successful}/${result.total} images successfully.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Image generation test failed:', error);
    process.exit(1);
  });