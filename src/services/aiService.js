import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
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

  async generateImagePrompts(scriptSentences, videoStyle = 'modern', theme = 'general') {
    try {
      const prompts = [];
      
      for (const sentence of scriptSentences) {
        const promptText = `
Create a DALL-E image prompt for the following script sentence:

Sentence: "${sentence}"

Style: ${videoStyle}
Theme: ${theme}

Requirements:
1. Create a visually appealing, professional image prompt
2. Make it suitable for ${videoStyle} style
3. Ensure it's appropriate for YouTube content
4. Keep it concise but detailed
5. Include relevant visual elements

Return only the image prompt, nothing else.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating detailed, effective prompts for AI image generation.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        });

        prompts.push(completion.choices[0].message.content.trim());
      }

      logger.info(`Generated ${prompts.length} image prompts`);
      return prompts;
    } catch (error) {
      logger.error('Error generating image prompts:', error);
      throw error;
    }
  }

  async generateImage(prompt, size = '1024x1024') {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'url'
      });

      const imageUrl = response.data[0].url;
      logger.info('Generated image successfully');
      
      return {
        url: imageUrl,
        prompt: prompt,
        revisedPrompt: response.data[0].revised_prompt
      };
    } catch (error) {
      logger.error('Error generating image:', error);
      throw error;
    }
  }

  async generateThumbnail(videoTitle, script, style = 'eye-catching') {
    try {
      const thumbnailPrompt = `
Create a compelling YouTube thumbnail for a video titled "${videoTitle}".

Script context: ${script.substring(0, 300)}...

Requirements:
1. ${style} and clickable design
2. Clear, bold text overlay with the main topic
3. Bright, contrasting colors
4. Professional quality
5. Suitable for YouTube thumbnail format (16:9 aspect ratio)
6. Eye-catching and scroll-stopping
7. Include relevant visual elements from the script

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
      
      const thumbnailImage = await this.generateImage(prompt, '1792x1024');
      
      logger.info('Generated thumbnail successfully');
      return {
        ...thumbnailImage,
        title: videoTitle,
        thumbnailPrompt: prompt
      };
    } catch (error) {
      logger.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  async enhanceContentWithAI(videoData) {
    try {
      logger.info('Starting AI content enhancement process');
      
      const [keywordData, attractiveScript] = await Promise.all([
        this.performKeywordResearch(videoData.transcriptText, videoData.channelTitle),
        this.generateAttractiveScript(videoData.transcriptText, videoData)
      ]);

      const [optimizedDescription, optimizedTitles] = await Promise.all([
        this.generateOptimizedDescription(attractiveScript, videoData, keywordData.primaryKeywords),
        this.generateOptimizedTitle(attractiveScript, videoData.title, keywordData.primaryKeywords)
      ]);

      const scriptSentences = await this.breakdownScriptIntoSentences(attractiveScript);
      const imagePrompts = await this.generateImagePrompts(scriptSentences);

      logger.info('AI content enhancement completed successfully');
      
      return {
        attractiveScript,
        optimizedDescription,
        optimizedTitles,
        keywords: keywordData,
        scriptSentences,
        imagePrompts
      };
    } catch (error) {
      logger.error('Error in AI content enhancement:', error);
      throw error;
    }
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