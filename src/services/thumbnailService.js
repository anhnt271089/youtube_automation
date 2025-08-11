import logger from '../utils/logger.js';
import { config } from '../../config/config.js';

class ThumbnailService {
  constructor(aiService, googleDriveService) {
    this.aiService = aiService;
    this.googleDriveService = googleDriveService;
    
    // Note: Removed caching system since Claude Sonnet is 85% cheaper than GPT-4o
    // Making it cost-effective to generate fresh prompts each time for better results
    
    // HIGH-CTR YouTube thumbnail styles based on proven viral psychology
    // Focus: Human faces, emotions, curiosity gaps, bold text, high contrast colors
    this.thumbnailStyles = {
      style1: {
        name: 'Viral Breakthrough',
        description: 'Human-focused thumbnail with discovery/breakthrough emotional psychology',
        prompt: 'Professional overhead photograph of an organized desk workspace. Show planning materials spread across wooden surface: open notebooks with diagrams, colorful sticky notes in patterns, calendar pages, pens, coffee cup, charts. Warm natural lighting with rich shadows and depth. Colors: warm wood tones, vibrant blues and oranges for papers, clean whites. Fill entire frame edge-to-edge with no borders or empty space. High-resolution photography style with inspiring organized aesthetic.'
      },
      style2: {
        name: 'Transformation Success',
        description: 'Before/after transformation theme with proven success psychology', 
        prompt: 'Professional portrait photograph of confident person with arms raised celebrating success. Person shows genuine joy and achievement with bright smile. Background filled with subtle success symbols: upward trending arrows, achievement badges, celebration elements. Dramatic lighting with person well-lit against dynamic background. Colors: deep blues for confidence, bright golds for success, warm skin tones. Fill entire frame edge-to-edge with no borders or empty space. High-energy portrait photography with motivational appeal.'
      }
    };
    
    // Standard YouTube thumbnail specifications
    this.thumbnailSpecs = {
      width: 1280,
      height: 720,
      format: config.app.thumbnailFormat || 'JPG',
      dalleSize: '1792x1024', // DALL-E 3 horizontal format
      quality: config.app.thumbnailQuality || 'standard'
    };
  }

  /**
   * Generate 2 YouTube thumbnails with different styles using stored concepts
   * @param {object} videoData - Video metadata and content
   * @param {string} videoId - Video identifier 
   * @param {string} storedConcepts - Optional stored thumbnail concepts from Video Detail Sheet
   * @returns {Promise<object>} Generated thumbnails with metadata
   */
  async generateTwoThumbnails(videoData, videoId, storedConcepts = null) {
    try {
      logger.info(`🖼️ Generating 2 thumbnails for ${videoId}${storedConcepts ? ' using stored concepts' : ''}`);
      
      const { title, transcriptText, optimizedScript } = videoData;
      let baseContext;
      
      // Use stored concepts if available, otherwise generate new context
      if (storedConcepts && storedConcepts.trim()) {
        logger.info(`📋 Using stored thumbnail concepts for ${videoId}`);
        baseContext = this.parseStoredThumbnailConcepts(storedConcepts, title);
        baseContext.usingStoredConcepts = true;
      } else {
        logger.info(`🤖 Generating fresh thumbnail context for ${videoId}`);
        baseContext = await this.generateThumbnailContext(title, transcriptText || optimizedScript);
        baseContext.usingStoredConcepts = false;
      }
      
      // Generate both thumbnails concurrently
      const [thumbnail1, thumbnail2] = await Promise.all([
        this.generateSingleThumbnail(baseContext, title, videoId, 'style1'),
        this.generateSingleThumbnail(baseContext, title, videoId, 'style2')
      ]);
      
      const fileExtension = this.thumbnailSpecs.format.toLowerCase();
      
      const result = {
        thumbnail1: {
          ...thumbnail1,
          fileName: `thumbnail_1.${fileExtension}`,
          style: this.thumbnailStyles.style1.name
        },
        thumbnail2: {
          ...thumbnail2,
          fileName: `thumbnail_2.${fileExtension}`, 
          style: this.thumbnailStyles.style2.name
        },
        totalGenerated: 2,
        specifications: this.thumbnailSpecs,
        conceptSource: baseContext.usingStoredConcepts ? 'stored_concepts' : 'fresh_generation',
        baseContext: baseContext
      };
      
      const sourceText = baseContext.usingStoredConcepts ? '(from stored concepts)' : '(fresh generation)';
      logger.info(`✅ Generated 2 thumbnails for ${videoId}: ${this.thumbnailStyles.style1.name} & ${this.thumbnailStyles.style2.name} ${sourceText}`);
      return result;
      
    } catch (error) {
      logger.error(`❌ Failed to generate thumbnails for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Parse stored thumbnail concepts from Video Detail Sheet
   * @param {string} storedConcepts - Raw thumbnail concepts text from sheet
   * @param {string} title - Video title for fallbacks
   * @returns {Object} Parsed thumbnail context for generation
   */
  parseStoredThumbnailConcepts(storedConcepts, title) {
    try {
      logger.info('📋 Parsing stored thumbnail concepts');
      
      // Try to parse as JSON first (new format from pre-computation)
      try {
        const jsonConcepts = JSON.parse(storedConcepts);
        if (jsonConcepts && jsonConcepts.mainTheme) {
          logger.info(`📋 Using JSON format concepts (generated: ${jsonConcepts.generatedAt || 'unknown'})`);
          // Return the parsed JSON directly (it already has the right structure)
          jsonConcepts.usingStoredConcepts = true;
          return jsonConcepts;
        }
      } catch (parseError) {
        // Not JSON, continue with legacy text parsing
        logger.info('📋 Using legacy text format parsing');
      }
      
      // Legacy text parsing (for older stored concepts)
      const concepts = storedConcepts.toLowerCase();
      
      // Extract key information from the detailed concepts
      const parsedContext = {
        mainTheme: title || 'Unknown Theme',
        keyElements: [],
        emotionalTone: 'inspiring',
        visualMetaphors: [],
        colorSuggestions: [],
        textElements: title || 'Engaging Content',
        style1Details: {},
        style2Details: {},
        scientificSpecs: {}
      };
      
      // Extract emotional tone
      if (concepts.includes('emotional') || concepts.includes('dramatic')) {
        parsedContext.emotionalTone = 'emotional';
      } else if (concepts.includes('professional') || concepts.includes('authority')) {
        parsedContext.emotionalTone = 'professional';
      } else if (concepts.includes('mysterious') || concepts.includes('secret')) {
        parsedContext.emotionalTone = 'mysterious';
      } else if (concepts.includes('educational') || concepts.includes('learning')) {
        parsedContext.emotionalTone = 'educational';
      }
      
      // Extract key visual elements
      const visualKeywords = [
        'face', 'faces', 'expression', 'emotion', 'close-up',
        'text', 'typography', 'bold', 'contrast', 'bright',
        'colors', 'vibrant', 'professional', 'clean', 'minimal',
        'charts', 'graphs', 'data', 'statistics', 'arrows',
        'success', 'growth', 'transformation', 'achievement'
      ];
      
      visualKeywords.forEach(keyword => {
        if (concepts.includes(keyword)) {
          parsedContext.keyElements.push(keyword);
        }
      });
      
      // Extract color information
      const colorPatterns = [
        /blue|#[0-9a-f]{6}.*blue/gi,
        /red|#[0-9a-f]{6}.*red/gi,
        /green|#[0-9a-f]{6}.*green/gi,
        /orange|#[0-9a-f]{6}.*orange/gi,
        /yellow|#[0-9a-f]{6}.*yellow/gi,
        /purple|#[0-9a-f]{6}.*purple/gi,
        /gold|#[0-9a-f]{6}.*gold/gi
      ];
      
      colorPatterns.forEach(pattern => {
        const matches = concepts.match(pattern);
        if (matches) {
          parsedContext.colorSuggestions.push(matches[0]);
        }
      });
      
      // Default colors if none found
      if (parsedContext.colorSuggestions.length === 0) {
        parsedContext.colorSuggestions = ['vibrant and engaging', 'high contrast'];
      }
      
      // Extract visual metaphors and concepts
      const metaphorKeywords = [
        'growth', 'success', 'transformation', 'achievement',
        'lightbulb', 'arrow', 'chart', 'graph', 'key', 'door',
        'spotlight', 'gold', 'luxury', 'prosperity', 'books'
      ];
      
      metaphorKeywords.forEach(keyword => {
        if (concepts.includes(keyword)) {
          parsedContext.visualMetaphors.push(keyword);
        }
      });
      
      // Default metaphors if none found
      if (parsedContext.visualMetaphors.length === 0) {
        parsedContext.visualMetaphors = ['success', 'engagement', 'value'];
      }
      
      // Extract style-specific information
      if (concepts.includes('style 1') || concepts.includes('emotional')) {
        parsedContext.style1Details = {
          approach: 'emotional/dramatic',
          colors: parsedContext.colorSuggestions.slice(0, 2),
          elements: ['close-up faces', 'bold text', 'high contrast']
        };
      }
      
      if (concepts.includes('style 2') || concepts.includes('professional')) {
        parsedContext.style2Details = {
          approach: 'professional/clean',
          colors: ['blue and white', 'minimal palette'],
          elements: ['clean typography', 'visual metaphors', 'authority signals']
        };
      }
      
      // Extract scientific specifications if available
      if (concepts.includes('ctr') || concepts.includes('performance')) {
        parsedContext.scientificSpecs = {
          hasPerformanceData: true,
          optimizedForMobile: concepts.includes('mobile'),
          hasColorScience: concepts.includes('hex') || concepts.includes('#'),
          hasTypographySpecs: concepts.includes('font') || concepts.includes('px')
        };
      }
      
      logger.info('✅ Successfully parsed stored thumbnail concepts');
      return parsedContext;
      
    } catch (error) {
      logger.warn('Failed to parse stored concepts, using title-based fallback:', error.message);
      
      // Fallback to basic parsing based on title
      return {
        mainTheme: title || 'Unknown Theme',
        keyElements: ['engaging', 'professional', 'clickable'],
        emotionalTone: 'inspiring',
        visualMetaphors: ['success', 'value'],
        colorSuggestions: ['vibrant', 'high contrast'],
        textElements: title || 'Engaging Content'
      };
    }
  }

  /**
   * Generate thumbnail concepts for caching (optimization)
   * @param {object} videoData - Video metadata and content
   * @param {string} videoId - Video identifier
   * @returns {Promise<string>} JSON string of thumbnail concepts for caching
   */
  async generateThumbnailConceptsForCaching(videoData, videoId) {
    try {
      logger.info(`🎨 Pre-generating thumbnail concepts for ${videoId} (optimization)`);
      
      const { title, transcriptText, optimizedScript } = videoData;
      const scriptContent = transcriptText || optimizedScript || title;
      
      // Generate concepts using the same logic as generateThumbnailContext
      const concepts = await this.generateThumbnailContext(title, scriptContent);
      
      // Add timestamp and processing info
      concepts.generatedAt = new Date().toISOString();
      concepts.videoId = videoId;
      concepts.source = 'pre-computation';
      
      const conceptsJson = JSON.stringify(concepts);
      logger.info(`✅ Generated thumbnail concepts for ${videoId} (${conceptsJson.length} chars)`);
      
      return conceptsJson;
      
    } catch (error) {
      logger.error(`❌ Failed to generate thumbnail concepts for ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Generate context-aware prompt for thumbnails
   * @private
   */
  async generateThumbnailContext(title, scriptContent) {
    try {
      // Safely handle null or undefined scriptContent
      const safeScriptContent = scriptContent || title || 'No content available';
      const contentPreview = safeScriptContent.toString().substring(0, 500);
      
      const prompt = `
Analyze this YouTube video content for HIGH-CTR thumbnail generation using VIRAL PSYCHOLOGY principles:

Title: "${title || 'Unknown Title'}"
Content: "${contentPreview}..."

Return JSON with thumbnail context optimized for maximum click-through rate:
{
  "mainTheme": "Core value proposition/benefit",
  "emotionalHook": "Primary emotional trigger (curiosity, urgency, transformation, discovery)",
  "humanElements": ["facial expression", "body language", "emotion to convey"],
  "visualElements": {
    "primary": "Main visual focal point or symbol",
    "secondary": "Supporting visual elements",
    "curiosityGap": "Visual intrigue element or compelling imagery"
  },
  "colorPsychology": {
    "primary": "High-contrast background color with hex code",
    "accent": "Text/element color with hex code",
    "emotion": "Psychological impact of color choice"
  },
  "viralElements": ["arrows", "before/after", "shocking element", "social proof"],
  "transformationAspect": "Before vs after or problem vs solution angle",
  "mobileClarifty": "Key elements that must be visible at 156x88px"
}

Focus on proven YouTube psychology: faces, emotions, curiosity gaps, transformation, urgency.`;

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
      
      // Enhanced JSON cleaning with multiple format support
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any leading/trailing whitespace and non-JSON content
      responseText = responseText.trim();
      
      // Find JSON object boundaries more robustly
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        responseText = responseText.substring(jsonStart, jsonEnd);
      }
      
      // Additional cleanup: remove any control characters or invisible characters
      responseText = responseText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      const parsedContext = JSON.parse(responseText);
      
      // Validate parsed context has required fields for viral psychology
      const validatedContext = {
        mainTheme: parsedContext.mainTheme || title || 'Success Method',
        emotionalHook: parsedContext.emotionalHook || 'breakthrough',
        humanElements: Array.isArray(parsedContext.humanElements) ? parsedContext.humanElements : ['confident expression', 'direct eye contact', 'discovery emotion'],
        visualElements: parsedContext.visualElements || {
          primary: 'Compelling visual symbol',
          secondary: 'Supporting imagery', 
          curiosityGap: 'Visual intrigue element'
        },
        colorPsychology: parsedContext.colorPsychology || {
          primary: '#1e3a8a',
          accent: '#fb923c',
          emotion: 'trust and energy'
        },
        viralElements: Array.isArray(parsedContext.viralElements) ? parsedContext.viralElements : ['arrows', 'checkmarks', 'transformation'],
        transformationAspect: parsedContext.transformationAspect || 'problem to solution',
        mobileClarifty: parsedContext.mobileClarifty || 'face and main text visible'
      };
      
      return validatedContext;
      
    } catch (error) {
      logger.warn('Failed to generate thumbnail context, using intelligent fallback:', error.message);
      
      // Enhanced fallback context using viral psychology principles
      const safeTitle = title || 'Success Method';
      let emotionalHook = 'breakthrough';
      let humanElements = ['confident expression', 'direct eye contact'];
      let colorPsychology = { primary: '#1e3a8a', accent: '#fb923c', emotion: 'trust and energy' };
      let viralElements = ['arrows', 'checkmarks'];
      let visualElements = { primary: 'Success symbol', secondary: 'Achievement imagery', curiosityGap: 'Compelling visual hook' };
      
      // Title-based psychology optimization
      const titleLower = safeTitle.toLowerCase();
      if (titleLower.includes('money') || titleLower.includes('rich') || titleLower.includes('wealth')) {
        emotionalHook = 'wealth transformation';
        humanElements = ['shocked expression', 'money gesture', 'success smile'];
        colorPsychology = { primary: '#166534', accent: '#fbbf24', emotion: 'wealth and success' };
        viralElements = ['dollar signs', 'growth arrows', 'before/after'];
        visualElements = { primary: 'Wealth symbols', secondary: 'Money imagery', curiosityGap: 'Financial success visuals' };
      } else if (titleLower.includes('plan') || titleLower.includes('strategy') || titleLower.includes('method')) {
        emotionalHook = 'discovery moment';
        humanElements = ['lightbulb expression', 'pointing gesture', 'aha moment'];
        colorPsychology = { primary: '#1e3a8a', accent: '#fb923c', emotion: 'trust and breakthrough' };
        viralElements = ['checklist', 'arrows', 'step numbers'];
        visualElements = { primary: 'Planning symbols', secondary: 'Organization imagery', curiosityGap: 'Strategy visuals' };
      } else if (titleLower.includes('secret') || titleLower.includes('hidden') || titleLower.includes('revealed')) {
        emotionalHook = 'forbidden knowledge';
        humanElements = ['whispering gesture', 'shocked face', 'secret reveal'];
        colorPsychology = { primary: '#7c2d12', accent: '#fbbf24', emotion: 'mystery and revelation' };
        viralElements = ['lock/key', 'spotlight', 'revealed elements'];
        visualElements = { primary: 'Mystery symbols', secondary: 'Revelation imagery', curiosityGap: 'Hidden truth visuals' };
      } else if (titleLower.includes('learn') || titleLower.includes('how') || titleLower.includes('guide')) {
        emotionalHook = 'knowledge mastery';
        humanElements = ['teaching gesture', 'confident expression', 'expert pose'];
        colorPsychology = { primary: '#1d4ed8', accent: '#f59e0b', emotion: 'authority and learning' };
        viralElements = ['arrows', 'step numbers', 'knowledge symbols'];
        visualElements = { primary: 'Learning symbols', secondary: 'Knowledge imagery', curiosityGap: 'Quick mastery visuals' };
      }
      
      return {
        mainTheme: safeTitle,
        emotionalHook,
        humanElements,
        visualElements,
        colorPsychology,
        viralElements,
        transformationAspect: 'problem to solution',
        mobileClarifty: 'face and main visual elements clearly visible'
      };
    }
  }

  /**
   * Get enhanced base prompt for thumbnail generation using Claude Sonnet (no caching needed - cheap!)
   * @private
   */
  async getEnhancedBasePrompt(context, title, videoId) {
    // No caching needed since Claude Sonnet is 85% cheaper than GPT-4o
    // Fresh prompts each time ensure better optimization and variety
    
    // Create base thumbnail prompt using viral psychology principles
    const baseThumbnailPrompt = `
Create a VIRAL HIGH-CTR YouTube thumbnail using proven click psychology.

VIDEO CONTEXT:
- Title: "${title}"
- Value Proposition: ${context.mainTheme || 'Transformation/Success'}
- Emotional Hook: ${context.emotionalHook || 'Discovery/Breakthrough'}
- Human Element: ${context.humanElements?.join(', ') || 'Confident expression, eye contact'}
- Visual Elements: ${context.visualElements?.primary || 'Compelling symbol'} + ${context.visualElements?.secondary || 'Supporting imagery'}

VIRAL PSYCHOLOGY REQUIREMENTS:
🎯 HUMAN FACE: Close-up with clear emotional expression (discovery, confidence, surprise)
🎯 EYE CONTACT: Direct viewer connection for psychological engagement
🎯 CURIOSITY GAP: Visual elements that create "what happens next" intrigue
🎯 TRANSFORMATION: Before/after or problem/solution visual cues
🎯 URGENCY SIGNALS: Elements suggesting immediate value/limited time

HIGH-CTR COLOR PSYCHOLOGY:
- PRIMARY: ${context.colorPsychology?.primary || 'Deep blue (#1e3a8a)'} for trust/authority
- ACCENT: ${context.colorPsychology?.accent || 'Bright orange (#fb923c)'} for energy/attention
- CONTRAST RATIO: Minimum 7:1 for mobile readability
- SATURATION: High saturation colors that pop in crowded feeds

TECHNICAL SPECIFICATIONS:
- CANVAS: FULL edge-to-edge usage, NO PADDING/BORDERS, NO EMPTY SPACE
- MOBILE FIRST: Clear visual storytelling at 156x88px thumbnail size
- NO TEXT OVERLAYS: Pure visual communication without written content
- RULE OF THIRDS: Position face/focal point strategically with supporting visuals filling remaining space

VIRAL ELEMENTS TO INCLUDE:
- ${context.viralElements?.join(', ') || 'Arrows, checkmarks, growth symbols'}
- Compelling visual symbols that trigger emotional responses
- Visual metaphors that instantly communicate value without text
- Social proof elements (visual cues, reactions, body language)

MOBILE OPTIMIZATION CRITICAL:
- Face must be clearly visible at thumbnail size
- Visual elements must be distinguishable at small sizes
- Identical appearance on desktop and mobile
- Stands out in crowded YouTube feed through compelling imagery alone

ABSOLUTE REQUIREMENTS:
- NO TEXT OVERLAYS OR WRITTEN CONTENT whatsoever
- FULL CANVAS COVERAGE edge-to-edge with NO EMPTY SPACE
- Content must fill entire image area completely

Create a thumbnail that triggers immediate emotional response and compels clicks through pure visual storytelling and psychological engagement.`;

    // Enhance with Claude Sonnet (85% cheaper than GPT-4o, no caching needed!)
    logger.info(`🧠 Enhancing base thumbnail prompt with Claude Sonnet for ${videoId}...`);
    const enhancedPrompt = await this.aiService.enhancePromptWithClaudeSonnet(baseThumbnailPrompt, {
      videoId,
      isThumbnail: true,
      size: this.thumbnailSpecs.dalleSize,
      model: 'leonardo-phoenix' // Default to Phoenix for thumbnails
    });
    
    logger.info(`✅ Base thumbnail prompt enhanced for ${videoId} (85% cost savings vs GPT-4o)`);
    
    return enhancedPrompt;
  }

  /**
   * Generate a single thumbnail with specific style
   * @private
   */
  async generateSingleThumbnail(context, title, videoId, styleKey) {
    const style = this.thumbnailStyles[styleKey];
    
    // Get enhanced base prompt (cached to avoid duplicate GPT-4o calls)
    const enhancedBasePrompt = await this.getEnhancedBasePrompt(context, title, videoId);
    
    // Apply style-specific modifications to the enhanced base prompt
    const styledPrompt = `${enhancedBasePrompt}

ADDITIONAL STYLE REQUIREMENTS:
${style.prompt}`;

    // Generate image using existing AI service WITHOUT Claude enhancement (already enhanced)
    const imageResult = await this.aiService.generateImage(styledPrompt, {
      size: this.thumbnailSpecs.dalleSize,
      quality: this.thumbnailSpecs.quality,
      videoId,
      model: config.app.imageModel || 'leonardo-phoenix', // Default to Leonardo for thumbnails
      isThumbnail: true,
      enhanceWithClaudeSonnet: false // Disable Claude enhancement since we already enhanced the base prompt
    });

    return {
      ...imageResult,
      prompt: styledPrompt,
      context,
      styleApplied: style.name,
      wasBasePromptEnhanced: true
    };
  }

  /**
   * Upload generated thumbnails to Google Drive
   * @param {object} thumbnails - Generated thumbnails object
   * @param {string} videoId - Video identifier
   * @param {string} videoTitle - Video title for folder identification
   * @param {object} googleSheetsService - Google Sheets service instance for updating folder URLs
   * @returns {Promise<object>} Upload results with Drive URLs
   */
  async uploadThumbnailsToDrive(thumbnails, videoId, videoTitle, googleSheetsService = null) {
    try {
      logger.info(`📁 Uploading thumbnails to Drive for ${videoId}`);
      
      // PRIORITY 1: Try to get existing Drive folder from video details in Google Sheets
      let videoFolder = null;
      let thumbnailFolder = null;
      
      if (googleSheetsService) {
        try {
          const videoDetails = await googleSheetsService.getVideoDetails(videoId);
          if (videoDetails && videoDetails.driveFolder) {
            logger.info(`📁 Found existing video folder from Google Sheets for ${videoId}: ${videoDetails.driveFolder}`);
            
            // Extract folder ID from Drive URL
            const folderIdMatch = videoDetails.driveFolder.match(/\/folders\/([a-zA-Z0-9-_]+)/);
            if (folderIdMatch) {
              const parentFolderId = folderIdMatch[1];
              
              // Verify the folder still exists in Drive
              try {
                const folderExists = await this.googleDriveService.drive.files.get({
                  fileId: parentFolderId,
                  fields: 'id, name, webViewLink'
                });
                
                if (folderExists.data) {
                  logger.info(`✅ Verified existing video folder exists in Drive: ${folderExists.data.name}`);
                  
                  videoFolder = {
                    folderId: parentFolderId,
                    folderName: folderExists.data.name,
                    folderUrl: folderExists.data.webViewLink
                  };
                  
                  // Look for existing "Generated Thumbnails" subfolder
                  thumbnailFolder = await this.findExistingThumbnailFolder(parentFolderId);
                  
                  if (!thumbnailFolder) {
                    logger.info(`🖼️ "Generated Thumbnails" folder not found, creating in existing video folder`);
                    thumbnailFolder = await this.findOrCreateThumbnailFolder(parentFolderId);
                  } else {
                    logger.info(`🖼️ Using existing "Generated Thumbnails" folder in video directory`);
                  }
                }
              } catch (verifyError) {
                logger.warn(`Failed to verify existing folder ${parentFolderId}: ${verifyError.message}`);
                // Continue to fallback logic
              }
            }
          } else {
            logger.info(`📁 No Drive folder URL found in Google Sheets for ${videoId}, checking for existing folders`);
          }
        } catch (sheetsError) {
          logger.warn(`Failed to get video details from Sheets: ${sheetsError.message}`);
        }
      }
      
      // PRIORITY 2: Search for existing video folder by name pattern if not found in Sheets
      if (!videoFolder) {
        logger.info(`📁 Searching for existing video folder by name pattern for ${videoId}`);
        const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
        const folderName = `${sanitizedTitle} (${videoId})`;
        
        try {
          const existingFolder = await this.findVideoFolder(folderName);
          if (existingFolder) {
            logger.info(`📁 Found existing video folder by name: ${folderName}`);
            videoFolder = existingFolder;
            
            // Update Google Sheets with found folder URL if we have access
            if (googleSheetsService && videoFolder.folderUrl) {
              try {
                await googleSheetsService.updateVideoField(videoId, 'driveFolder', videoFolder.folderUrl);
                logger.info(`📝 Updated ${videoId} Drive folder URL in Google Sheets`);
              } catch (updateError) {
                logger.warn(`Failed to update Drive folder URL in sheets for ${videoId}:`, updateError.message);
              }
            }
            
            // Find or create "Generated Thumbnails" subfolder
            thumbnailFolder = await this.findOrCreateThumbnailFolder(videoFolder.folderId);
          }
        } catch (findError) {
          logger.warn(`Failed to find existing video folder: ${findError.message}`);
        }
      }
      
      // LAST RESORT: Create new folder structure only if no existing folder found
      if (!videoFolder) {
        logger.warn(`📁 No existing video folder found for ${videoId}, creating new folder structure as last resort`);
        const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
        const folderName = `${sanitizedTitle} (${videoId})`;
        
        videoFolder = await this.createVideoFolder(folderName);
        
        // Update Google Sheets with new folder URL if we have access
        if (googleSheetsService && videoFolder.folderUrl) {
          try {
            await googleSheetsService.updateVideoField(videoId, 'driveFolder', videoFolder.folderUrl);
            logger.info(`📝 Updated ${videoId} Drive folder URL in Google Sheets`);
          } catch (updateError) {
            logger.warn(`Failed to update Drive folder URL in sheets for ${videoId}:`, updateError.message);
          }
        }
        
        // Create "Generated Thumbnails" subfolder in new folder
        thumbnailFolder = await this.findOrCreateThumbnailFolder(videoFolder.folderId);
      }
      
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
   * Find or create video folder in Google Drive
   * @private
   */
  async findVideoFolder(folderName) {
    try {
      // Try multiple folder ID configurations for legacy compatibility
      const possibleParentIds = [
        config.google.driveFolderId,
        config.google.videosRootFolderId
      ].filter(id => id); // Remove undefined/null values
      
      let folder = null;
      
      // Search in each possible parent folder
      for (const parentId of possibleParentIds) {
        const response = await this.googleDriveService.drive.files.list({
          q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentId}' and trashed=false`,
          fields: 'files(id, name, webViewLink)'
        });

        if (response.data.files.length > 0) {
          folder = response.data.files[0];
          logger.info(`✅ Found existing video folder: ${folderName} in parent ${parentId}`);
          break;
        }
      }
      
      if (folder) {
        return {
          folderId: folder.id,
          folderName: folder.name,
          folderUrl: folder.webViewLink
        };
      }
      
      // Return null if folder not found - do not create automatically
      logger.info(`📁 Video folder not found: ${folderName}`);
      return null;
      
    } catch (error) {
      logger.error('Error finding video folder:', error);
      throw error;
    }
  }

  /**
   * Create video folder for legacy videos that don't have one
   * @private
   */
  async createVideoFolder(folderName) {
    try {
      // Use videosRootFolderId as primary parent, fallback to driveFolderId
      const parentFolderId = config.google.videosRootFolderId || config.google.driveFolderId;
      
      if (!parentFolderId) {
        throw new Error('No parent folder ID configured for video folder creation');
      }
      
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const response = await this.googleDriveService.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      const newFolder = {
        folderId: response.data.id,
        folderName: response.data.name,
        folderUrl: response.data.webViewLink
      };
      
      logger.info(`Created new video folder for legacy video: ${folderName} - ${newFolder.folderUrl}`);
      
      return newFolder;
      
    } catch (error) {
      logger.error('Error creating video folder:', error);
      throw error;
    }
  }

  /**
   * Find existing "Generated Thumbnails" subfolder (created during script generation)
   * @private
   */
  async findExistingThumbnailFolder(parentFolderId) {
    const thumbnailFolderName = 'Generated Thumbnails';
    
    try {
      // Look for existing "Generated Thumbnails" folder
      const response = await this.googleDriveService.drive.files.list({
        q: `name='${thumbnailFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentFolderId}' and trashed=false`,
        fields: 'files(id, name, webViewLink)'
      });

      if (response.data.files.length > 0) {
        const folder = response.data.files[0];
        logger.info(`Found existing "Generated Thumbnails" folder in video directory`);
        return {
          folderId: folder.id,
          folderName: folder.name,
          folderUrl: folder.webViewLink
        };
      }

      logger.warn(`No existing "Generated Thumbnails" folder found in parent ${parentFolderId}`);
      return null;
      
    } catch (error) {
      logger.error('Error finding existing thumbnail folder:', error);
      return null;
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
        q: `name='${thumbnailFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentFolderId}' and trashed=false`,
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

      // Create folder if it doesn't exist (for legacy videos)
      logger.info(`Creating "Generated Thumbnails" subfolder for legacy video`);
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
   * Check if thumbnails already exist for a video
   * @param {string} videoId - Video identifier
   * @param {string} videoTitle - Video title for folder identification
   * @returns {Promise<object>} Existing thumbnail information
   */
  async checkExistingThumbnails(videoId, videoTitle) {
    try {
      logger.info(`🔍 Checking existing thumbnails for ${videoId}`);
      
      // Find the video folder
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
      const folderName = `${sanitizedTitle} (${videoId})`;
      
      // Search for existing video folder
      const videoFolder = await this.findVideoFolder(folderName);
      if (!videoFolder) {
        return {
          exists: false,
          reason: 'Video folder not found',
          thumbnails: []
        };
      }
      
      // Check for thumbnail folder
      const response = await this.googleDriveService.drive.files.list({
        q: `name='Generated Thumbnails' and mimeType='application/vnd.google-apps.folder' and parents in '${videoFolder.folderId}'`,
        fields: 'files(id, name, webViewLink)'
      });
      
      if (response.data.files.length === 0) {
        return {
          exists: false,
          reason: 'Thumbnail folder not found',
          thumbnails: []
        };
      }
      
      const thumbnailFolder = response.data.files[0];
      
      // Check for thumbnail files
      const thumbnailFiles = await this.googleDriveService.drive.files.list({
        q: `parents in '${thumbnailFolder.id}' and (name contains 'thumbnail' or name contains '.jpg' or name contains '.png')`,
        fields: 'files(id, name, webViewLink, size, createdTime)'
      });
      
      const existingThumbnails = thumbnailFiles.data.files.map(file => ({
        fileId: file.id,
        fileName: file.name,
        viewLink: file.webViewLink,
        directLink: `https://drive.google.com/uc?id=${file.id}`,
        size: file.size,
        createdTime: file.createdTime
      }));
      
      const result = {
        exists: existingThumbnails.length > 0,
        count: existingThumbnails.length,
        thumbnails: existingThumbnails,
        folderUrl: thumbnailFolder.webViewLink,
        videoFolderUrl: videoFolder.folderUrl
      };
      
      if (result.exists) {
        logger.info(`✅ Found ${result.count} existing thumbnails for ${videoId}`);
      } else {
        logger.info(`📋 No existing thumbnails found for ${videoId}`);
      }
      
      return result;
      
    } catch (error) {
      logger.warn(`⚠️ Error checking existing thumbnails for ${videoId}:`, error);
      return {
        exists: false,
        reason: `Error: ${error.message}`,
        thumbnails: []
      };
    }
  }

  /**
   * No longer needed - caching removed since Claude Sonnet is 85% cheaper than GPT-4o
   * Fresh prompts each time provide better optimization and variety
   */

  /**
   * Generate complete thumbnail workflow for a video with enhanced error handling
   * @param {object} videoData - Complete video data
   * @param {string} videoId - Video identifier
   * @param {boolean} forceRegenerate - Force regeneration even if thumbnails exist
   * @param {object} googleSheetsService - Optional Google Sheets service for updating URLs
   * @returns {Promise<object>} Complete thumbnail generation and upload results
   */
  async processVideoThumbnails(videoData, videoId, forceRegenerate = false, googleSheetsService = null, storedConcepts = null) {
    const startTime = Date.now();
    let result = {
      success: false,
      generated: 0,
      uploaded: 0,
      failed: 0,
      skipped: false,
      error: null,
      processingTime: 0,
      videoId,
      videoTitle: videoData?.title || 'Unknown Title'
    };
    
    try {
      logger.info(`🎨 Starting enhanced thumbnail workflow for ${videoId}`);
      
      // Validate input data
      if (!videoData) {
        throw new Error('Video data is required for thumbnail processing');
      }
      
      if (!videoId) {
        throw new Error('Video ID is required for thumbnail processing');
      }
      
      // Ensure we have a title (critical for folder naming)
      const safeVideoTitle = videoData.title || videoId || 'Unknown Video';
      result.videoTitle = safeVideoTitle;
      
      // Step 0: Check if thumbnails already exist (unless forcing regeneration)
      if (!forceRegenerate) {
        try {
          const existingThumbnails = await this.checkExistingThumbnails(videoId, safeVideoTitle);
          
          if (existingThumbnails.exists) {
            logger.info(`♻️ Thumbnails already exist for ${videoId}, skipping generation`);
            result = {
              ...result,
              generated: 0,
              uploaded: 0,
              skipped: true,
              existing: {
                count: existingThumbnails.count,
                thumbnails: existingThumbnails.thumbnails,
                folderUrl: existingThumbnails.folderUrl,
                videoFolderUrl: existingThumbnails.videoFolderUrl
              },
              success: true,
              message: 'Thumbnails already exist - skipped generation',
              processingTime: Date.now() - startTime
            };
            return result;
          }
        } catch (checkError) {
          logger.warn(`Failed to check existing thumbnails for ${videoId}, proceeding with generation:`, checkError.message);
          // Continue with generation despite check failure
        }
      }
      
      // Step 0.5: Use provided stored concepts or retrieve from GoogleSheetsService
      let conceptsToUse = storedConcepts; // Use passed parameter first
      
      if (!conceptsToUse && googleSheetsService) {
        try {
          logger.info(`🔍 No concepts provided, checking stored thumbnail concepts for ${videoId}`);
          conceptsToUse = await googleSheetsService.getStoredThumbnailConcepts(videoId);
          if (conceptsToUse) {
            logger.info(`📋 Found stored thumbnail concepts for ${videoId} (${conceptsToUse.length} chars)`);
          } else {
            logger.info(`📋 No stored thumbnail concepts found for ${videoId}, using fresh generation`);
          }
        } catch (conceptError) {
          logger.warn(`Failed to retrieve stored concepts for ${videoId}, falling back to fresh generation:`, conceptError.message);
          conceptsToUse = null;
        }
      } else if (conceptsToUse) {
        logger.info(`📋 Using provided thumbnail concepts for ${videoId} (${conceptsToUse.length} chars) - optimized workflow`);
      } else {
        logger.info(`📋 No concepts available for ${videoId}, using fresh generation`);
      }
      
      // Step 1: Generate 2 thumbnails with error handling (using stored concepts if available)
      let thumbnails;
      try {
        thumbnails = await this.generateTwoThumbnails(videoData, videoId, conceptsToUse);
        result.generated = thumbnails.totalGenerated || 0;
        result.conceptSource = thumbnails.conceptSource || 'unknown';
        logger.info(`✅ Generated ${result.generated} thumbnails for ${videoId} (${result.conceptSource})`);
      } catch (generationError) {
        result.error = `Thumbnail generation failed: ${generationError.message}`;
        result.processingTime = Date.now() - startTime;
        logger.error(`❌ Thumbnail generation failed for ${videoId}:`, generationError);
        return result;
      }
      
      // Step 2: Upload to Google Drive with error handling
      let uploadResults;
      try {
        uploadResults = await this.uploadThumbnailsToDrive(thumbnails, videoId, safeVideoTitle, googleSheetsService);
        result.uploaded = uploadResults.successCount || 0;
        result.failed = (uploadResults.totalCount || 0) - (uploadResults.successCount || 0);
        logger.info(`✅ Uploaded ${result.uploaded}/${uploadResults.totalCount || 0} thumbnails for ${videoId}`);
      } catch (uploadError) {
        result.error = `Thumbnail upload failed: ${uploadError.message}`;
        result.processingTime = Date.now() - startTime;
        logger.error(`❌ Thumbnail upload failed for ${videoId}:`, uploadError);
        return result;
      }
      
      // Step 3: Prepare successful result
      result = {
        ...result,
        success: result.uploaded > 0,
        thumbnails: {
          thumbnail1: {
            style: thumbnails.thumbnail1?.style || 'Unknown',
            fileName: thumbnails.thumbnail1?.fileName || 'thumbnail_1.jpg',
            upload: uploadResults.uploads?.thumbnail1 || null
          },
          thumbnail2: {
            style: thumbnails.thumbnail2?.style || 'Unknown',
            fileName: thumbnails.thumbnail2?.fileName || 'thumbnail_2.jpg',
            upload: uploadResults.uploads?.thumbnail2 || null
          }
        },
        driveFolder: uploadResults.thumbnailFolderUrl || null,
        videoFolderUrl: uploadResults.folderUrl || null,
        specifications: thumbnails.specifications || null,
        processingTime: Date.now() - startTime
      };
      
      const statusMessage = result.success ? '✅ SUCCESS' : '⚠️ PARTIAL SUCCESS';
      logger.info(`🎨 ${statusMessage} - Thumbnail workflow for ${videoId}: ${result.uploaded}/${result.generated} uploaded in ${result.processingTime}ms`);
      
      return result;
      
    } catch (error) {
      result.error = `Unexpected error: ${error.message}`;
      result.processingTime = Date.now() - startTime;
      logger.error(`❌ Thumbnail workflow failed for ${videoId}:`, error);
      
      return result;
    }
  }
}

export default ThumbnailService;