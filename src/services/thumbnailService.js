import logger from '../utils/logger.js';
import { config } from '../../config/config.js';

class ThumbnailService {
  constructor(aiService, googleDriveService) {
    this.aiService = aiService;
    this.googleDriveService = googleDriveService;
    
    // Thumbnail generation styles for variety
    this.thumbnailStyles = {
      style1: {
        name: 'Emotional/Dramatic',
        description: 'High-contrast, emotional faces, bold colors, dramatic lighting',
        prompt: 'emotional dramatic style with bright vibrant colors, close-up expressive faces showing strong emotions, bold typography, high contrast lighting, eye-catching dramatic composition, YouTube thumbnail optimized for maximum engagement'
      },
      style2: {
        name: 'Professional/Clean',
        description: 'Minimal design, clear typography, professional aesthetic',
        prompt: 'professional clean minimalist design with modern typography, sophisticated color palette, clean composition with visual metaphors, premium business aesthetic, contemporary professional style optimized for authority and trust'
      }
    };
    
    // Standard YouTube thumbnail specifications
    this.thumbnailSpecs = {
      width: 1280,
      height: 720,
      format: 'PNG',
      dalleSize: '1792x1024', // DALL-E 3 closest to 16:9 ratio
      quality: 'standard'
    };
  }

  /**
   * Generate 2 YouTube thumbnails with different styles
   * @param {object} videoData - Video metadata and content
   * @param {string} videoId - Video identifier 
   * @returns {Promise<object>} Generated thumbnails with metadata
   */
  async generateTwoThumbnails(videoData, videoId) {
    try {
      logger.info(`🖼️ Generating 2 thumbnails for ${videoId}`);
      
      const { title, transcriptText, optimizedScript } = videoData;
      
      // Generate base prompt context from video content
      const baseContext = await this.generateThumbnailContext(title, transcriptText || optimizedScript);
      
      // Generate both thumbnails concurrently
      const [thumbnail1, thumbnail2] = await Promise.all([
        this.generateSingleThumbnail(baseContext, title, videoId, 'style1'),
        this.generateSingleThumbnail(baseContext, title, videoId, 'style2')
      ]);
      
      const result = {
        thumbnail1: {
          ...thumbnail1,
          fileName: 'thumbnail_1.png',
          style: this.thumbnailStyles.style1.name
        },
        thumbnail2: {
          ...thumbnail2,
          fileName: 'thumbnail_2.png', 
          style: this.thumbnailStyles.style2.name
        },
        totalGenerated: 2,
        specifications: this.thumbnailSpecs
      };
      
      logger.info(`✅ Generated 2 thumbnails for ${videoId}: ${this.thumbnailStyles.style1.name} & ${this.thumbnailStyles.style2.name}`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to generate thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Generate context-aware prompt for thumbnails
   * @private
   */
  async generateThumbnailContext(title, scriptContent) {
    try {
      const prompt = `
Analyze this YouTube video content and extract key visual elements for thumbnail creation:

Title: "${title}"
Content: "${scriptContent.substring(0, 500)}..."

Extract and return a JSON object with thumbnail context:
{
  "mainTheme": "Primary topic/subject",
  "keyElements": ["visual element 1", "visual element 2", "visual element 3"],
  "emotionalTone": "Target emotional response",
  "visualMetaphors": ["metaphor 1", "metaphor 2"],
  "colorSuggestions": ["color theme 1", "color theme 2"],
  "textElements": "Key text that should be readable on thumbnail"
}

Focus on elements that would make compelling, clickable YouTube thumbnails.`;

      const completion = await this.aiService.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      let responseText = completion.content[0].text.trim();
      
      // Clean JSON response
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }

      return JSON.parse(responseText);
      
    } catch (error) {
      logger.warn('Failed to generate thumbnail context, using fallback:', error);
      // Fallback context
      return {
        mainTheme: title,
        keyElements: ['inspiring', 'educational', 'engaging'],
        emotionalTone: 'inspiring',
        visualMetaphors: ['growth', 'success', 'transformation'],
        colorSuggestions: ['blue and white', 'vibrant and energetic'],
        textElements: title
      };
    }
  }

  /**
   * Generate a single thumbnail with specific style
   * @private
   */
  async generateSingleThumbnail(context, title, videoId, styleKey) {
    const style = this.thumbnailStyles[styleKey];
    
    const thumbnailPrompt = `
Create a premium YouTube thumbnail optimized for maximum click-through rate and engagement.

VIDEO CONTEXT:
- Title: "${title}"
- Main Theme: ${context.mainTheme}
- Emotional Tone: ${context.emotionalTone}
- Key Elements: ${context.keyElements.join(', ')}
- Visual Metaphors: ${context.visualMetaphors.join(', ')}
- Color Suggestions: ${context.colorSuggestions.join(', ')}

STYLE REQUIREMENTS:
${style.prompt}

TECHNICAL SPECIFICATIONS:
- Aspect ratio: 16:9 optimized for YouTube
- Mobile-friendly: Clear visibility on small screens
- High contrast: Readable text and clear focal points
- Professional quality: Premium, polished appearance
- Engagement optimization: Compelling visual hierarchy

DESIGN ELEMENTS:
- Clear focal point with ${context.emotionalTone} expression
- Space for readable text overlay
- ${context.colorSuggestions[0] || 'vibrant'} color palette
- Visual metaphors: ${context.visualMetaphors.slice(0,2).join(' and ')}
- Professional lighting and composition

Create a thumbnail that captures attention in YouTube feed and encourages clicks while maintaining high quality and professionalism.`;

    // Generate image using existing AI service
    const imageResult = await this.aiService.generateImage(thumbnailPrompt, {
      size: this.thumbnailSpecs.dalleSize,
      quality: this.thumbnailSpecs.quality,
      videoId,
      model: config.app.imageModel || 'dall-e-3'
    });

    return {
      ...imageResult,
      prompt: thumbnailPrompt,
      context,
      styleApplied: style.name
    };
  }

  /**
   * Upload generated thumbnails to Google Drive
   * @param {object} thumbnails - Generated thumbnails object
   * @param {string} videoId - Video identifier
   * @param {string} videoTitle - Video title for folder identification
   * @returns {Promise<object>} Upload results with Drive URLs
   */
  async uploadThumbnailsToDrive(thumbnails, videoId, videoTitle) {
    try {
      logger.info(`📁 Uploading thumbnails to Drive for ${videoId}`);
      
      // Find the video folder
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
      const folderName = `${sanitizedTitle} (${videoId})`;
      
      // Search for existing video folder
      const videoFolder = await this.findVideoFolder(folderName);
      if (!videoFolder) {
        throw new Error(`Video folder not found: ${folderName}`);
      }
      
      // Find or create "Generated Thumbnails" subfolder
      const thumbnailFolder = await this.findOrCreateThumbnailFolder(videoFolder.folderId);
      
      // Download and upload each thumbnail
      const uploadResults = {};
      
      for (const [key, thumbnail] of Object.entries(thumbnails)) {
        if (key.startsWith('thumbnail') && thumbnail.url) {
          try {
            const uploadResult = await this.downloadAndUploadThumbnail(
              thumbnail.url,
              thumbnail.fileName,
              thumbnailFolder.folderId
            );
            
            uploadResults[key] = {
              ...uploadResult,
              style: thumbnail.style,
              fileName: thumbnail.fileName
            };
            
            logger.info(`✅ Uploaded ${thumbnail.fileName}: ${thumbnail.style}`);
            
          } catch (uploadError) {
            logger.error(`❌ Failed to upload ${thumbnail.fileName}:`, uploadError);
            uploadResults[key] = { error: uploadError.message };
          }
        }
      }
      
      const successfulUploads = Object.values(uploadResults).filter(r => !r.error).length;
      logger.info(`📁 Uploaded ${successfulUploads}/${Object.keys(uploadResults).length} thumbnails to Drive`);
      
      return {
        uploads: uploadResults,
        folderUrl: videoFolder.folderUrl,
        thumbnailFolderUrl: thumbnailFolder.folderUrl,
        successCount: successfulUploads,
        totalCount: Object.keys(uploadResults).length
      };
      
    } catch (error) {
      logger.error(`❌ Failed to upload thumbnails to Drive for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Find video folder in Google Drive
   * @private
   */
  async findVideoFolder(folderName) {
    try {
      const response = await this.googleDriveService.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${config.google.driveFolderId}'`,
        fields: 'files(id, name, webViewLink)'
      });

      if (response.data.files.length > 0) {
        const folder = response.data.files[0];
        return {
          folderId: folder.id,
          folderName: folder.name,
          folderUrl: folder.webViewLink
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error finding video folder:', error);
      throw error;
    }
  }

  /**
   * Find or create "Generated Thumbnails" subfolder
   * @private
   */
  async findOrCreateThumbnailFolder(parentFolderId) {
    const thumbnailFolderName = 'Generated Thumbnails';
    
    try {
      // First, try to find existing folder
      const response = await this.googleDriveService.drive.files.list({
        q: `name='${thumbnailFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentFolderId}'`,
        fields: 'files(id, name, webViewLink)'
      });

      if (response.data.files.length > 0) {
        const folder = response.data.files[0];
        return {
          folderId: folder.id,
          folderName: folder.name,
          folderUrl: folder.webViewLink
        };
      }

      // Create folder if it doesn't exist
      const folderMetadata = {
        name: thumbnailFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const folder = await this.googleDriveService.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      return {
        folderId: folder.data.id,
        folderName: folder.data.name,
        folderUrl: folder.data.webViewLink
      };
      
    } catch (error) {
      logger.error('Error with thumbnail folder:', error);
      throw error;
    }
  }

  /**
   * Download image from URL and upload to Google Drive
   * @private
   */
  async downloadAndUploadThumbnail(imageUrl, fileName, folderId) {
    try {
      // Download image from OpenAI
      const axios = (await import('axios')).default;
      const response = await axios.get(imageUrl, { 
        responseType: 'stream',
        timeout: 30000
      });

      // Upload to Google Drive
      const uploadResult = await this.googleDriveService.uploadFile(
        response.data,
        fileName,
        folderId,
        'image/png'
      );

      // Make file publicly viewable
      await this.googleDriveService.drive.permissions.create({
        fileId: uploadResult.id,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return {
        fileId: uploadResult.id,
        fileName: uploadResult.name,
        viewLink: uploadResult.webViewLink,
        directLink: `https://drive.google.com/uc?id=${uploadResult.id}`,
        success: true
      };
      
    } catch (error) {
      logger.error('Error downloading and uploading thumbnail:', error);
      throw error;
    }
  }

  /**
   * Generate complete thumbnail workflow for a video
   * @param {object} videoData - Complete video data
   * @param {string} videoId - Video identifier
   * @returns {Promise<object>} Complete thumbnail generation and upload results
   */
  async processVideoThumbnails(videoData, videoId) {
    try {
      logger.info(`🎨 Starting thumbnail workflow for ${videoId}`);
      
      // Step 1: Generate 2 thumbnails
      const thumbnails = await this.generateTwoThumbnails(videoData, videoId);
      
      // Step 2: Upload to Google Drive
      const uploadResults = await this.uploadThumbnailsToDrive(thumbnails, videoId, videoData.title);
      
      // Step 3: Prepare summary
      const result = {
        generated: thumbnails.totalGenerated,
        uploaded: uploadResults.successCount,
        failed: uploadResults.totalCount - uploadResults.successCount,
        thumbnails: {
          thumbnail1: {
            style: thumbnails.thumbnail1.style,
            fileName: thumbnails.thumbnail1.fileName,
            upload: uploadResults.uploads.thumbnail1
          },
          thumbnail2: {
            style: thumbnails.thumbnail2.style,
            fileName: thumbnails.thumbnail2.fileName,
            upload: uploadResults.uploads.thumbnail2
          }
        },
        driveFolder: uploadResults.thumbnailFolderUrl,
        specifications: thumbnails.specifications,
        success: uploadResults.successCount === thumbnails.totalGenerated
      };
      
      logger.info(`🎨 Thumbnail workflow completed for ${videoId}: ${result.uploaded}/${result.generated} uploaded successfully`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Thumbnail workflow failed for ${videoId}:`, error);
      throw error;
    }
  }
}

export default ThumbnailService;