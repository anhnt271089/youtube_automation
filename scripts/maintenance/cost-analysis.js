#!/usr/bin/env node
/**
 * Cost Analysis Script for YouTube Image Generation
 * 
 * Compare costs between different image generation models
 * and calculate potential savings
 */

import { config } from '../config/config.js';

function calculateCosts() {
  console.log('📊 YouTube Image Generation Cost Analysis\n');
  
  // Pricing per image
  const pricing = {
    'dall-e-2': 0.02,
    'dall-e-3': 0.04,
    'dall-e-3-hd': 0.08
  };
  
  // Scenarios
  const scenarios = [
    { name: 'Single Video (20 images)', images: 20 },
    { name: 'Single Video (50 images)', images: 50 },
    { name: 'Monthly Production (100 videos, 30 images each)', images: 3000 },
    { name: 'Scale Production (500 videos, 25 images each)', images: 12500 }
  ];
  
  console.log('💰 Cost Comparison by Model:\n');
  
  scenarios.forEach(scenario => {
    console.log(`📹 ${scenario.name}:`);
    console.log('   Model      | Cost/Image | Total Cost | vs DALL-E 3 | Savings');
    console.log('   -----------|------------|------------|-------------|--------');
    
    Object.entries(pricing).forEach(([model, cost]) => {
      const totalCost = cost * scenario.images;
      const dalle3Cost = pricing['dall-e-3'] * scenario.images;
      const savings = dalle3Cost - totalCost;
      const savingsPercent = ((savings / dalle3Cost) * 100).toFixed(1);
      
      console.log(`   ${model.padEnd(10)} | $${cost.toFixed(4).padStart(6)} | $${totalCost.toFixed(2).padStart(8)} | ${savingsPercent.padStart(8)}% | $${savings.toFixed(2)}`);
    });
    console.log('');
  });
  
  // Current configuration analysis
  console.log('⚙️ Current Configuration Analysis:\n');
  console.log(`Current Model: ${config.app.imageModel}`);
  console.log(`Max Budget Per Video: $${config.app.maxImageCostPerVideo}`);
  console.log(`Image Dimensions: ${config.app.imageWidth}x${config.app.imageHeight}`);
  
  const currentCostPerImage = pricing[config.app.imageModel] || pricing['dall-e-2'];
  const maxImagesPerVideo = Math.floor(config.app.maxImageCostPerVideo / currentCostPerImage);
  
  console.log(`Cost per image: $${currentCostPerImage.toFixed(4)}`);
  console.log(`Max images per video (within budget): ${maxImagesPerVideo}`);
  
  // Annual projections
  console.log('\n📅 Annual Cost Projections:\n');
  
  const monthlyVideos = [50, 100, 200, 500]; // Different production scales
  const imagesPerVideo = 30; // Average images per video
  
  console.log('Videos/Month | DALL-E 2   | DALL-E 3   | DALL-E 3 HD | Annual Savings (vs DALL-E 3)');
  console.log('-------------|------------|------------|-------------|-------------------------');
  
  monthlyVideos.forEach(videos => {
    const monthlyImages = videos * imagesPerVideo;
    const annualImages = monthlyImages * 12;
    
    const dalle2Annual = annualImages * pricing['dall-e-2'];
    const dalle3Annual = annualImages * pricing['dall-e-3'];
    const dalle3HdAnnual = annualImages * pricing['dall-e-3-hd'];
    const savings = dalle3Annual - dalle2Annual;
    
    console.log(`${videos.toString().padStart(11)} | $${dalle2Annual.toFixed(0).padStart(8)} | $${dalle3Annual.toFixed(0).padStart(8)} | $${dalle3HdAnnual.toFixed(0).padStart(9)} | $${savings.toFixed(0)}`);
  });
  
  // Break-even analysis
  console.log('\n🎯 Break-even Analysis:\n');
  
  const digitalOceanMonthlyCost = 5; // Estimated monthly DO Spaces cost
  const googleDriveCost = 0; // Free tier, but has limitations
  
  console.log('DALL-E 2 + Digital Ocean vs DALL-E 3 + Google Drive:\n');
  
  monthlyVideos.forEach(videos => {
    const monthlyImages = videos * imagesPerVideo;
    
    // DALL-E 2 + DO Spaces
    const dalle2Cost = monthlyImages * pricing['dall-e-2'];
    const option1Total = dalle2Cost + digitalOceanMonthlyCost;
    
    // DALL-E 3 + Google Drive
    const dalle3Cost = monthlyImages * pricing['dall-e-3'];
    const option2Total = dalle3Cost + googleDriveCost;
    
    const monthlySavings = option2Total - option1Total;
    const annualSavings = monthlySavings * 12;
    
    console.log(`${videos} videos/month:`);
    console.log(`  DALL-E 2 + DO Spaces: $${option1Total.toFixed(2)}/month`);
    console.log(`  DALL-E 3 + Google Drive: $${option2Total.toFixed(2)}/month`);
    console.log(`  Monthly savings: $${monthlySavings.toFixed(2)}`);
    console.log(`  Annual savings: $${annualSavings.toFixed(2)}`);
    console.log('');
  });
  
  // Recommendations
  console.log('💡 Recommendations:\n');
  
  if (config.app.imageModel === 'dall-e-3') {
    const potentialSavings = pricing['dall-e-3'] - pricing['dall-e-2'];
    console.log(`🔄 Switch to DALL-E 2: Save $${potentialSavings.toFixed(4)} per image (50% cost reduction)`);
  } else {
    console.log('✅ Already using cost-optimized DALL-E 2');
  }
  
  if (config.app.imageWidth !== 1920 || config.app.imageHeight !== 1080) {
    console.log('📐 Update image dimensions to 1920x1080 for YouTube optimization');
  } else {
    console.log('✅ Using YouTube-optimized dimensions (1920x1080)');
  }
  
  if (!config.digitalOcean?.bucketName) {
    console.log('☁️ Configure Digital Ocean Spaces for reliable, scalable storage');
  } else {
    console.log('✅ Digital Ocean Spaces configured');
  }
  
  const budgetEfficiency = (maxImagesPerVideo * currentCostPerImage) / config.app.maxImageCostPerVideo;
  if (budgetEfficiency < 0.8) {
    console.log(`💰 Budget underutilized: Using ${(budgetEfficiency * 100).toFixed(1)}% of available budget`);
    console.log(`   Consider increasing image limit or reducing budget`);
  } else {
    console.log(`✅ Budget efficiently utilized: ${(budgetEfficiency * 100).toFixed(1)}%`);
  }
  
  console.log('\n🚀 Optimal Configuration for Maximum Savings:');
  console.log('   IMAGE_MODEL=dall-e-2');
  console.log('   IMAGE_WIDTH=1920');
  console.log('   IMAGE_HEIGHT=1080');
  console.log('   MAX_IMAGE_COST_PER_VIDEO=1.50');
  console.log('   COST_TRACKING_ENABLED=true');
  console.log('   (Configure Digital Ocean Spaces for storage)');
}

// Run analysis
calculateCosts();