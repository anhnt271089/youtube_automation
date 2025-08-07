import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import DigitalOceanService from './digitalOceanService.js';
import axios from 'axios';
// import fs from 'fs';
// import path from 'path';

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    
    this.digitalOceanService = new DigitalOceanService();
    
    // Cost tracking
    this.costTracker = {
      totalCost: 0,
      imagesGenerated: 0,
      videoCosts: new Map()
    };
    
    // Image model pricing (per image)
    this.imagePricing = {
      'dall-e-2': 0.02,
      'dall-e-3': 0.04, // standard quality
      'dall-e-3-hd': 0.08 // HD quality
    };
    
    // Style templates for consistent image generation
    this.styleTemplates = {
      'minimalist': 'clean minimalist design, simple flat colors, modern aesthetic, white background',
      'realistic': 'photorealistic style, high detail, natural lighting, professional photography',
      'illustration': 'hand-drawn illustration style, artistic, colorful, creative design',
      'corporate': 'professional corporate style, clean lines, business aesthetic, modern',
      'vibrant': 'vibrant colors, energetic style, dynamic composition, eye-catching',
      'tech': 'modern tech aesthetic, digital style, futuristic elements, clean interface design',
      'educational': 'educational illustration style, clear diagrams, informative visuals, professional'
    };
  }

  async generateAttractiveScript(originalTranscript, videoMetadata) {
    try {
      const prompt = `
You are a professional YouTube content creator and scriptwriter. Transform the following video transcript into a more engaging, attractive script for a 2-3 minute video.

Original Video Information:
- Title: ${videoMetadata.title}
- Channel: ${videoMetadata.channelTitle}
- Description: ${videoMetadata.description?.substring(0, 500)}

Original Transcript:
${originalTranscript}

Requirements:
1. Keep the core message and information intact
2. Make it more engaging and conversational
3. Add hooks and compelling transitions
4. Optimize for 2-3 minute duration
5. Include clear call-to-actions
6. Make it suitable for short-form content

Return only the improved script without any additional commentary.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert YouTube scriptwriter specializing in creating engaging short-form content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const generatedScript = completion.choices[0].message.content.trim();
      logger.info('Generated attractive script successfully');
      
      return generatedScript;
    } catch (error) {
      logger.error('Error generating attractive script:', error);
      throw error;
    }
  }

  async generateOptimizedDescription(script, originalMetadata, keywords = []) {
    try {
      const prompt = `
Create an optimized YouTube video description based on the following information:

Script Content:
${script}

Original Video Data:
- Title: ${originalMetadata.title}
- Channel: ${originalMetadata.channelTitle}
- Original Description: ${originalMetadata.description?.substring(0, 300)}

Keywords to include: ${keywords.join(', ')}

Requirements:
1. Create a compelling description that includes relevant keywords naturally
2. Include a brief engaging summary of the video content
3. Add relevant hashtags (5-10)
4. Include a call-to-action
5. Keep it under 1000 characters for optimal engagement
6. Make it SEO-friendly

Return only the optimized description.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube SEO expert specializing in creating optimized video descriptions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.6
      });

      const optimizedDescription = completion.choices[0].message.content.trim();
      logger.info('Generated optimized description successfully');
      
      return optimizedDescription;
    } catch (error) {
      logger.error('Error generating optimized description:', error);
      throw error;
    }
  }

  async generateOptimizedTitle(script, originalTitle, keywords = []) {
    try {
      const prompt = `
Create 5 optimized YouTube video titles based on the following:

Original Title: ${originalTitle}
Script Content: ${script.substring(0, 500)}...
Keywords: ${keywords.join(', ')}

Requirements:
1. Titles should be attention-grabbing and clickable
2. Include relevant keywords naturally
3. Keep titles under 60 characters for full visibility
4. Make them emotional and compelling
5. Ensure they accurately represent the content

Return 5 title options, each on a new line, numbered 1-5.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube optimization expert specializing in creating viral, clickable titles.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.8
      });

      const titleOptions = completion.choices[0].message.content.trim();
      const titles = titleOptions.split('\n').map(title => title.replace(/^\d+\.\s*/, '').trim());
      
      logger.info('Generated optimized titles successfully');
      
      return {
        options: titles,
        recommended: titles[0]
      };
    } catch (error) {
      logger.error('Error generating optimized titles:', error);
      throw error;
    }
  }

  async performKeywordResearch(videoContent, niche = '') {
    try {
      const prompt = `
Perform keyword research for a YouTube video based on the following content:

Video Content: ${videoContent.substring(0, 800)}
Niche/Category: ${niche}

Generate:
1. 10 primary keywords (high search volume, relevant)
2. 10 long-tail keywords (more specific, less competition)
3. 5 trending hashtags
4. 5 related topics for content expansion

Format the response as JSON with the following structure:
{
  "primaryKeywords": [],
  "longTailKeywords": [],
  "trendingHashtags": [],
  "relatedTopics": []
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube SEO and keyword research specialist.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.5
      });

      let responseText = completion.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const keywordData = JSON.parse(responseText);
      logger.info('Performed keyword research successfully');
      
      return keywordData;
    } catch (error) {
      logger.error('Error performing keyword research:', error);
      return {
        primaryKeywords: [],
        longTailKeywords: [],
        trendingHashtags: [],
        relatedTopics: []
      };
    }
  }

  async breakdownScriptIntoSentences(script) {
    try {
      const prompt = `
Break down the following script into individual sentences that are suitable for creating images/visuals. Each sentence should:
1. Be complete and make sense on its own
2. Be suitable for visual representation
3. Be concise but meaningful
4. Flow naturally when combined

Script:
${script}

Return the sentences as a JSON array of strings, like this:
["sentence 1", "sentence 2", "sentence 3", ...]`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at breaking down video scripts into visually-suitable segments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      let responseText = completion.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const sentences = JSON.parse(responseText);
      logger.info(`Broke down script into ${sentences.length} sentences`);
      
      return sentences;
    } catch (error) {
      logger.error('Error breaking down script:', error);
      throw error;
    }
  }

  /**
   * Select a consistent visual style for the entire video
   * @param {string} script - Video script content
   * @param {object} metadata - Video metadata
   * @returns {Promise<{style: string, template: string, description: string}>}
   */
  async selectVideoStyle(script, metadata) {
    try {
      const prompt = `
Analyze the following video content and select the most appropriate visual style:

Title: ${metadata.title}
Channel: ${metadata.channelTitle}
Script Preview: ${script.substring(0, 500)}...

Available styles:
1. minimalist - Clean, simple, modern
2. realistic - Photorealistic, professional
3. illustration - Hand-drawn, artistic
4. corporate - Professional, business-oriented
5. vibrant - Colorful, energetic
6. tech - Modern, digital, futuristic
7. educational - Clear, informative diagrams

Return only the style name (one word) that best matches this content.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a visual design expert specializing in selecting appropriate styles for video content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 20,
        temperature: 0.3
      });

      const selectedStyle = completion.choices[0].message.content.trim().toLowerCase();
      const validStyle = this.styleTemplates[selectedStyle] ? selectedStyle : 'minimalist';
      
      logger.info(`Selected video style: ${validStyle}`);
      
      return {
        style: validStyle,
        template: this.styleTemplates[validStyle],
        description: `Consistent ${validStyle} style throughout the video`
      };
    } catch (error) {
      logger.error('Error selecting video style:', error);
      // Default fallback
      return {
        style: 'minimalist',
        template: this.styleTemplates.minimalist,
        description: 'Default minimalist style'
      };
    }
  }

  async generateImagePrompts(scriptSentences, videoStyle = null, metadata = {}) {
    try {
      // Select consistent style for the entire video if not provided
      let styleInfo = videoStyle;
      if (!styleInfo || typeof styleInfo === 'string') {
        const script = scriptSentences.join(' ');
        styleInfo = await this.selectVideoStyle(script, metadata);
      }
      
      const prompts = [];
      const baseStylePrompt = styleInfo.template;
      
      for (const sentence of scriptSentences) {
        const promptText = `
Create a high-quality DALL-E image prompt for the following script sentence:

Sentence: "${sentence}"

STYLE REQUIREMENTS (MUST BE CONSISTENT):
${baseStylePrompt}

Enhanced Requirements:
1. Create a visually stunning, professional image that represents the sentence
2. MUST maintain the exact same ${styleInfo.style} style as other images
3. Optimize for YouTube video format (16:9 aspect ratio, 1920x1080)
4. Use high-quality, premium visual elements with excellent composition
5. Include detailed lighting, shadows, and depth for professional appearance
6. Ensure visual consistency across all images in this video
7. Add specific visual metaphors and symbols that enhance the content
8. Use vibrant, engaging colors that work well for social media
9. Include subtle gradients, textures, or patterns to add visual interest
10. Make sure text overlay areas are clean and uncluttered

ENHANCED VISUAL ELEMENTS:
- Professional lighting and composition
- Rich color palette with high contrast
- Detailed textures and materials
- Dynamic perspectives and angles
- Symbolic imagery that reinforces the message
- High-resolution quality appearance
- Modern, polished aesthetic

IMPORTANT: Start your prompt with "${baseStylePrompt}, " to ensure consistency.

Return only the complete enhanced image prompt, nothing else.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating detailed, consistent prompts for AI image generation. Always maintain the exact same visual style throughout a video series.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          max_tokens: 200,
          temperature: 0.6
        });

        const fullPrompt = completion.choices[0].message.content.trim();
        prompts.push({
          prompt: fullPrompt,
          sentence: sentence,
          style: styleInfo.style
        });
      }

      logger.info(`Generated ${prompts.length} consistent ${styleInfo.style} image prompts`);
      return {
        prompts,
        videoStyle: styleInfo
      };
    } catch (error) {
      logger.error('Error generating image prompts:', error);
      throw error;
    }
  }

  async generateEditorKeywords(scriptSentences) {
    try {
      const editorKeywords = [];
      
      for (const sentence of scriptSentences) {
        const promptText = `
Extract 3-6 key words or phrases that ACTUALLY APPEAR in the following script sentence. These keywords will help video editors find relevant B-roll footage.

Script Sentence: "${sentence}"

Requirements:
1. ONLY extract words/phrases that exist in the sentence - do not create new keywords
2. Focus on important nouns, action verbs, and visual elements that appear in the text
3. Highlight words that would help find stock footage or B-roll
4. Include the most visually significant words from the sentence
5. Separate with commas
6. Use the exact words as they appear in the sentence (maintain capitalization if meaningful)

Examples:
- For "The market crashed in 2008 causing widespread panic": market, crashed, 2008, widespread panic
- For "She walked through the forest path": walked, forest, path
- For "Technology is changing our daily lives rapidly": Technology, changing, daily lives, rapidly

Return only the comma-separated keywords that exist in the sentence, nothing else.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting key words and phrases that actually appear in text for video editing purposes. Only highlight words that exist in the original sentence.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });

        const keywords = completion.choices[0].message.content.trim();
        editorKeywords.push(keywords);
      }

      logger.info(`Generated editor keywords for ${editorKeywords.length} sentences`);
      return editorKeywords;
    } catch (error) {
      logger.error('Error generating editor keywords:', error);
      throw error;
    }
  }

  /**
   * Calculate cost for image generation
   * @param {string} model - Image generation model
   * @param {number} count - Number of images
   * @returns {number} Cost in USD
   */
  calculateImageCost(model = config.app.imageModel, count = 1) {
    const costPerImage = this.imagePricing[model] || this.imagePricing['dall-e-2'];
    return costPerImage * count;
  }

  /**
   * Track costs for a video
   * @param {string} videoId - Video identifier
   * @param {number} cost - Cost to add
   * @param {string} type - Type of cost (image, processing, etc.)
   */
  trackVideoCost(videoId, cost, type = 'image') {
    if (!this.costTracker.videoCosts.has(videoId)) {
      this.costTracker.videoCosts.set(videoId, { total: 0, breakdown: {} });
    }
    
    const videoCost = this.costTracker.videoCosts.get(videoId);
    videoCost.total += cost;
    videoCost.breakdown[type] = (videoCost.breakdown[type] || 0) + cost;
    
    this.costTracker.totalCost += cost;
    
    logger.info(`Video ${videoId} cost: $${videoCost.total.toFixed(4)} (+$${cost.toFixed(4)} ${type})`);
  }

  /**
   * Check if video is within budget
   * @param {string} videoId - Video identifier
   * @param {number} additionalCost - Additional cost to check
   * @returns {boolean} Whether the cost is within budget
   */
  isWithinBudget(videoId, additionalCost = 0) {
    const currentCost = this.costTracker.videoCosts.has(videoId) ? 
      this.costTracker.videoCosts.get(videoId).total : 0;
    const totalCost = currentCost + additionalCost;
    
    return totalCost <= config.app.maxImageCostPerVideo;
  }

  async generateImage(prompt, options = {}) {
    try {
      // Default options for YouTube video format
      const defaultOptions = {
        size: `${config.app.imageWidth}x${config.app.imageHeight}`, // 1920x1080 for YouTube
        model: config.app.imageModel, // Use configured model (dall-e-2 by default)
        quality: 'standard',
        videoId: null
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      // Check budget if video ID provided
      if (finalOptions.videoId) {
        const estimatedCost = this.calculateImageCost(finalOptions.model, 1);
        if (!this.isWithinBudget(finalOptions.videoId, estimatedCost)) {
          const currentCost = this.costTracker.videoCosts.get(finalOptions.videoId)?.total || 0;
          logger.warn(`Image generation would exceed budget. Current: $${currentCost.toFixed(4)}, Max: $${config.app.maxImageCostPerVideo}`);
          throw new Error(`Budget exceeded: Current cost $${currentCost.toFixed(4)}, additional $${estimatedCost.toFixed(4)} would exceed max $${config.app.maxImageCostPerVideo}`);
        }
      }

      // Generate image based on model
      let response;
      let actualCost = 0;
      
      if (finalOptions.model.startsWith('dall-e')) {
        // Validate size for DALL-E models
        const validSizes = {
          'dall-e-2': ['256x256', '512x512', '1024x1024'],
          'dall-e-3': ['1024x1024', '1792x1024', '1024x1792']
        };
        
        let imageSize = finalOptions.size;
        if (finalOptions.model === 'dall-e-2' && !validSizes['dall-e-2'].includes(imageSize)) {
          imageSize = '1024x1024'; // Fallback for DALL-E 2
          logger.info(`DALL-E 2 doesn't support ${finalOptions.size}, using 1024x1024`);
        } else if (finalOptions.model === 'dall-e-3' && !validSizes['dall-e-3'].includes(imageSize)) {
          imageSize = '1792x1024'; // 16:9 aspect ratio for DALL-E 3
          logger.info(`Using DALL-E 3 with 16:9 format: ${imageSize}`);
        }
        
        // Build parameters based on model capabilities
        const generateParams = {
          model: finalOptions.model,
          prompt: prompt,
          n: 1,
          size: imageSize,
          response_format: 'url'
        };
        
        // DALL-E 3 supports quality parameter, DALL-E 2 does not
        if (finalOptions.model === 'dall-e-3') {
          generateParams.quality = finalOptions.quality;
        }
        
        response = await this.openai.images.generate(generateParams);
        
        actualCost = this.calculateImageCost(
          finalOptions.model === 'dall-e-3' && finalOptions.quality === 'hd' ? 'dall-e-3-hd' : finalOptions.model,
          1
        );
      } else {
        throw new Error(`Unsupported image model: ${finalOptions.model}`);
      }

      const imageUrl = response.data[0].url;
      
      // Track cost
      if (finalOptions.videoId) {
        this.trackVideoCost(finalOptions.videoId, actualCost, 'image');
      }
      this.costTracker.imagesGenerated++;
      
      logger.info(`Generated ${finalOptions.model} image successfully (Cost: $${actualCost.toFixed(4)})`);
      
      return {
        url: imageUrl,
        prompt: prompt,
        revisedPrompt: response.data[0].revised_prompt || prompt,
        model: finalOptions.model,
        size: finalOptions.size,
        cost: actualCost
      };
    } catch (error) {
      logger.error('Error generating image:', error);
      throw error;
    }
  }

  async generateThumbnail(videoTitle, script, options = {}) {
    try {
      const { style = 'eye-catching', videoId, videoStyle } = options;
      
      // Use consistent style if provided
      const styleTemplate = videoStyle?.template || 'eye-catching and clickable design';
      
      const thumbnailPrompt = `
Create a compelling YouTube thumbnail for a video titled "${videoTitle}".

Script context: ${script.substring(0, 300)}...

Style: ${styleTemplate}

Requirements:
1. ${style} and clickable design
2. Clear, bold text overlay with the main topic
3. Bright, contrasting colors that stand out
4. Professional quality suitable for YouTube
5. Optimized for 16:9 aspect ratio (1920x1080 or 1792x1024)
6. Eye-catching and scroll-stopping
7. Include relevant visual elements from the script
8. Maintain consistent style with video content

Create a detailed prompt for generating this thumbnail image.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert YouTube thumbnail designer who creates high-converting, clickable thumbnails.'
          },
          {
            role: 'user',
            content: thumbnailPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const prompt = completion.choices[0].message.content.trim();
      
      // Generate thumbnail with cost tracking
      const thumbnailOptions = {
        size: '1792x1024', // Best 16:9 ratio for DALL-E 3
        videoId,
        quality: 'standard'
      };
      
      const thumbnailImage = await this.generateImage(prompt, thumbnailOptions);
      
      logger.info('Generated thumbnail successfully');
      return {
        ...thumbnailImage,
        title: videoTitle,
        thumbnailPrompt: prompt,
        style: videoStyle?.style || 'custom'
      };
    } catch (error) {
      logger.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  /**
   * Download image from URL and upload to Digital Ocean Spaces
   * @param {string} imageUrl - URL of the image to download
   * @param {string} fileName - Name for the uploaded file
   * @param {string} videoId - Video identifier for folder organization
   * @returns {Promise<{url: string, cdnUrl: string}>}
   */
  async downloadAndUploadImage(imageUrl, fileName, videoId) {
    try {
      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
      
      const imageBuffer = Buffer.from(response.data);
      
      // Upload to Digital Ocean Spaces
      const uploadResult = await this.digitalOceanService.uploadImage(
        imageBuffer,
        fileName,
        `videos/${videoId}/images`
      );
      
      logger.info(`Image uploaded to DO Spaces: ${uploadResult.cdnUrl}`);
      return uploadResult;
    } catch (error) {
      logger.error('Error downloading and uploading image:', error);
      throw error;
    }
  }

  /**
   * Generate all images for a video with cost control and consistent styling
   * @param {Array} imagePrompts - Array of prompt objects
   * @param {string} videoId - Video identifier
   * @param {object} options - Generation options
   * @returns {Promise<Array>} Generated images with metadata
   */
  async generateVideoImages(imagePrompts, videoId, options = {}) {
    try {
      const { maxImages = config.app.imageGenerationLimit || imagePrompts.length } = options;
      const promptsToGenerate = imagePrompts.slice(0, maxImages > 0 ? maxImages : imagePrompts.length);
      
      // Check total estimated cost
      const estimatedCost = this.calculateImageCost(config.app.imageModel, promptsToGenerate.length);
      if (!this.isWithinBudget(videoId, estimatedCost)) {
        logger.warn(`Total estimated cost ($${estimatedCost.toFixed(4)}) would exceed budget for video ${videoId}`);
        const maxAffordableImages = Math.floor(config.app.maxImageCostPerVideo / this.imagePricing[config.app.imageModel]);
        logger.info(`Limiting to ${maxAffordableImages} images to stay within budget`);
        promptsToGenerate.splice(maxAffordableImages);
      }
      
      const generatedImages = [];
      
      for (let i = 0; i < promptsToGenerate.length; i++) {
        const promptObj = promptsToGenerate[i];
        try {
          logger.info(`Generating image ${i + 1}/${promptsToGenerate.length} for video ${videoId}`);
          
          // Generate image
          const imageResult = await this.generateImage(promptObj.prompt, {
            videoId,
            model: config.app.imageModel
          });
          
          // Download and upload to Digital Ocean Spaces
          const fileName = `${videoId.replace(/-/g, '_')}_image_${String(i + 1).padStart(3, '0')}.jpg`;
          const uploadResult = await this.downloadAndUploadImage(
            imageResult.url,
            fileName,
            videoId
          );
          
          generatedImages.push({
            index: i + 1,
            sentence: promptObj.sentence,
            prompt: promptObj.prompt,
            style: promptObj.style,
            originalUrl: imageResult.url,
            uploadedUrl: uploadResult.cdnUrl,
            fileName,
            cost: imageResult.cost
          });
          
          // Small delay to avoid rate limits
          if (i < promptsToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          logger.error(`Failed to generate image ${i + 1}:`, error);
          // Continue with other images
        }
      }
      
      const totalCost = generatedImages.reduce((sum, img) => sum + img.cost, 0);
      logger.info(`Generated ${generatedImages.length} images for video ${videoId} (Total cost: $${totalCost.toFixed(4)})`);
      
      return generatedImages;
    } catch (error) {
      logger.error('Error generating video images:', error);
      throw error;
    }
  }

  async enhanceContentWithAI(videoData) {
    try {
      logger.info('Starting AI content enhancement process');
      
      // Initialize cost tracking for this video
      const videoId = videoData.videoId || videoData.id;
      
      const [keywordData, attractiveScript] = await Promise.all([
        this.performKeywordResearch(videoData.transcriptText, videoData.channelTitle),
        this.generateAttractiveScript(videoData.transcriptText, videoData)
      ]);

      const [optimizedDescription, optimizedTitles] = await Promise.all([
        this.generateOptimizedDescription(attractiveScript, videoData, keywordData.primaryKeywords),
        this.generateOptimizedTitle(attractiveScript, videoData.title, keywordData.primaryKeywords)
      ]);

      const scriptSentences = await this.breakdownScriptIntoSentences(attractiveScript);
      
      const [imagePromptsData, editorKeywords] = await Promise.all([
        this.generateImagePrompts(scriptSentences, null, videoData),
        this.generateEditorKeywords(scriptSentences)
      ]);
      
      // Generate thumbnail with consistent style
      const thumbnail = await this.generateThumbnail(
        optimizedTitles.recommended,
        attractiveScript,
        { videoId, videoStyle: imagePromptsData.videoStyle }
      );
      
      // Generate all images with cost control
      const generatedImages = await this.generateVideoImages(
        imagePromptsData.prompts,
        videoId
      );

      logger.info('AI content enhancement completed successfully');
      
      return {
        attractiveScript,
        optimizedDescription,
        optimizedTitles,
        keywords: keywordData,
        scriptSentences,
        imagePrompts: imagePromptsData.prompts,
        videoStyle: imagePromptsData.videoStyle,
        generatedImages,
        thumbnail,
        editorKeywords,
        costSummary: {
          totalCost: this.costTracker.videoCosts.get(videoId)?.total || 0,
          breakdown: this.costTracker.videoCosts.get(videoId)?.breakdown || {},
          imagesGenerated: generatedImages.length
        }
      };
    } catch (error) {
      logger.error('Error in AI content enhancement:', error);
      throw error;
    }
  }

  /**
   * Get cost summary for all videos
   * @returns {object} Cost tracking summary
   */
  getCostSummary() {
    return {
      totalCost: this.costTracker.totalCost,
      totalImagesGenerated: this.costTracker.imagesGenerated,
      videoCount: this.costTracker.videoCosts.size,
      averageCostPerVideo: this.costTracker.videoCosts.size > 0 ? 
        this.costTracker.totalCost / this.costTracker.videoCosts.size : 0,
      videoCosts: Object.fromEntries(this.costTracker.videoCosts),
      budgetPerVideo: config.app.maxImageCostPerVideo,
      costSavingsVsDallE3: this.costTracker.imagesGenerated * 
        (this.imagePricing['dall-e-3'] - this.imagePricing[config.app.imageModel])
    };
  }

  async healthCheck() {
    try {
      // Test OpenAI API with a simple completion
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Say "AI service is working" if you can respond.'
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      });

      if (completion.choices && completion.choices.length > 0) {
        logger.info('AI service health check passed');
        return true;
      } else {
        throw new Error('Invalid response from OpenAI API');
      }
    } catch (error) {
      logger.error('AI service health check failed:', error);
      throw error;
    }
  }
}

export default AIService;