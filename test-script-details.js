#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import NotionService from './src/services/notionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function testScriptDetails() {
  try {
    console.log('🔍 Testing Script Details Database Access...');
    
    const notionService = new NotionService();
    
    // Video ID from the recent run
    const videoId = '24747ea7-5bd1-8127-8a1b-de8aba35419b';
    
    console.log(`📋 Searching for script details for video: ${videoId}`);
    
    // Get the video page to find child databases
    const videoPage = await notionService.notion.pages.retrieve({ 
      page_id: videoId 
    });
    
    console.log('📄 Video page retrieved:', videoPage.properties['🔒 Title']?.title[0]?.text?.content);
    
    // List children of the video page to find the Script Details database
    const children = await notionService.notion.blocks.children.list({
      block_id: videoId,
    });
    
    console.log(`👥 Found ${children.results.length} child blocks`);
    
    // Find the database block
    const scriptDatabase = children.results.find(child => 
      child.type === 'child_database' && 
      child.child_database?.title?.includes('Script Details')
    );
    
    if (!scriptDatabase) {
      console.log('❌ Script Details database not found in children');
      console.log('Available children:');
      children.results.forEach((child, index) => {
        console.log(`  ${index + 1}. ${child.type}: ${child.child_database?.title || child.child_page?.title || 'No title'}`);
      });
      return;
    }
    
    console.log('✅ Found Script Details database:', scriptDatabase.id);
    
    // Query the Script Details database
    const scriptDetails = await notionService.notion.databases.query({
      database_id: scriptDatabase.id,
      sorts: [
        {
          property: '🔒 Sentence Number',
          direction: 'ascending'
        }
      ]
    });
    
    console.log(`📊 Found ${scriptDetails.results.length} script sentences`);
    
    // Display first 5 sentences with image prompts
    console.log('\n📝 First 5 sentences with image prompts:');
    for (let i = 0; i < Math.min(5, scriptDetails.results.length); i++) {
      const sentence = scriptDetails.results[i];
      const sentenceNum = sentence.properties['🔒 Sentence Number']?.number;
      const scriptText = sentence.properties['🔒 Script Text']?.rich_text[0]?.text?.content || '';
      const imagePrompt = sentence.properties['🔒 Image Prompt']?.rich_text[0]?.text?.content || '';
      const generatedImageUrl = sentence.properties['🔒 Generated Image URL']?.url || '';
      
      console.log(`\n${sentenceNum}. Script: ${scriptText.substring(0, 100)}...`);
      console.log(`   Image Prompt: ${imagePrompt.substring(0, 100)}...`);
      console.log(`   Generated Image URL: ${generatedImageUrl || 'Not generated yet'}`);
    }
    
    return {
      databaseId: scriptDatabase.id,
      sentences: scriptDetails.results
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
testScriptDetails()
  .then((result) => {
    console.log('\n✅ Script details retrieval completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });