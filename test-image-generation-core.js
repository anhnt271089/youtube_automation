#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import AIService from './src/services/aiService.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function testCoreImageGeneration() {
  try {
    console.log('🎨 Testing Core Image Generation Pipeline...');
    
    const aiService = new AIService();
    
    // Sample image prompts derived from "The Art of Doing Anything Exceptionally Well" video
    // These would normally come from the Script Details database
    const samplePrompts = [
      "A determined artist holding a paintbrush, surrounded by unfinished canvases, representing the journey of mastery and dedication",
      "An elderly Japanese master craftsman Hokusai working on a detailed painting at age 73, showing patience and expertise", 
      "A montage showing repetitive practice - musician playing scales, athlete training, artist sketching the same subject multiple times",
      "A visual metaphor of excellence - a mountain path leading upward with milestones representing different levels of mastery",
      "A close-up of hands practicing the same basic movement over and over, with slight improvements visible in each attempt"
    ];
    
    console.log(`📝 Testing with ${samplePrompts.length} sample image prompts`);
    console.log(`🔧 Configuration: IMAGE_GENERATION_LIMIT=${process.env.IMAGE_GENERATION_LIMIT || 5}`);
    
    const generatedImages = [];
    
    // Test generating images as per the workflow limit
    const imagesToGenerate = Math.min(parseInt(process.env.IMAGE_GENERATION_LIMIT || '5'), samplePrompts.length);
    console.log(`🎯 Generating ${imagesToGenerate} images based on configuration\n`);
    
    for (let i = 0; i < imagesToGenerate; i++) {
      const prompt = samplePrompts[i];
      console.log(`🖼️  Generating image ${i + 1}/${imagesToGenerate}:`);
      console.log(`   Prompt: ${prompt.substring(0, 80)}...`);
      
      const startTime = Date.now();
      
      try {
        // Generate image using DALL-E
        const imageResult = await aiService.generateImage(prompt);
        const generationTime = Date.now() - startTime;
        
        console.log(`   ✅ Generated successfully in ${(generationTime/1000).toFixed(2)}s`);
        console.log(`   🔗 DALL-E URL: ${imageResult.url}`);
        
        // Download and save the image locally
        const imageResponse = await fetch(imageResult.url);
        const imageBuffer = await imageResponse.arrayBuffer();
        const fileName = `workflow_image_${i + 1}.png`;
        const tempPath = path.join(__dirname, 'temp', fileName);
        
        await fs.writeFile(tempPath, Buffer.from(imageBuffer));
        console.log(`   📁 Saved locally: ${tempPath}`);
        
        // Get file stats
        const stats = await fs.stat(tempPath);
        console.log(`   📊 File size: ${(stats.size / 1024).toFixed(1)} KB`);
        
        generatedImages.push({
          prompt: prompt,
          originalUrl: imageResult.url,
          localPath: tempPath,
          fileName: fileName,
          sizeKB: Math.round(stats.size / 1024),
          generationTimeMs: generationTime
        });
        
      } catch (error) {
        console.error(`   ❌ Error generating image ${i + 1}:`, error.message);
      }
      
      // Small delay between requests to be respectful to API
      if (i < imagesToGenerate - 1) {
        console.log('   ⏳ Waiting 2s before next generation...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Summary
    console.log('\n📊 Image Generation Summary:');
    console.log(`   Total prompts available: ${samplePrompts.length}`);
    console.log(`   Images attempted: ${imagesToGenerate}`);
    console.log(`   Successfully generated: ${generatedImages.length}`);
    console.log(`   Success rate: ${((generatedImages.length / imagesToGenerate) * 100).toFixed(1)}%`);
    
    if (generatedImages.length > 0) {
      const avgTime = generatedImages.reduce((sum, img) => sum + img.generationTimeMs, 0) / generatedImages.length;
      const totalSize = generatedImages.reduce((sum, img) => sum + img.sizeKB, 0);
      
      console.log(`   Average generation time: ${(avgTime/1000).toFixed(2)}s`);
      console.log(`   Total file size: ${totalSize} KB`);
      
      console.log('\n🎉 Generated Images:');
      generatedImages.forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.fileName} (${img.sizeKB} KB)`);
        console.log(`      Local: ${img.localPath}`);
        console.log(`      Original: ${img.originalUrl.substring(0, 80)}...`);
      });
      
      console.log('\n✅ Core image generation pipeline is working correctly!');
      console.log('📝 Note: Google Drive upload requires shared drive or OAuth delegation for service accounts');
    }
    
    return {
      successful: generatedImages.length,
      total: imagesToGenerate,
      images: generatedImages
    };
    
  } catch (error) {
    console.error('❌ Error in core image generation test:', error);
    throw error;
  }
}

// Run the test
testCoreImageGeneration()
  .then((result) => {
    console.log(`\n🏆 Test completed successfully! Generated ${result.successful}/${result.total} images.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });