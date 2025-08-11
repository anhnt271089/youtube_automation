import logger from '../utils/logger.js';
import { config } from '../../config/config.js';

class ThumbnailService {
  constructor(aiService, googleDriveService) {
    this.aiService = aiService;
    this.googleDriveService = googleDriveService;
    
    // Processing locks to prevent concurrent thumbnail generation for same video
    this.processingLocks = new Map();
    
    // Note: Removed caching system since Claude Sonnet is 85% cheaper than GPT-4o
    // Making it cost-effective to generate fresh prompts each time for better results
    
    // Content-driven thumbnail styles that adapt to video subject matter
    // Maintains high CTR while being relevant to actual content
    this.thumbnailStyles = {
      style1: {
        name: 'Content Focus',
        description: 'Primary content representation with optimized psychology',
        adaptToContent: true
      },
      style2: {
        name: 'Transformation Angle', 
        description: 'Before/after or problem/solution perspective',
        adaptToContent: true
      }
    };
    
    // Standard YouTube thumbnail specifications
    this.thumbnailSpecs = {
      width: 1280,
      height: 720,
      format: config.app.thumbnailFormat || 'JPG',
      leonardoSize: '1280x720', // YouTube thumbnail format for Leonardo AI
      dalleSize: '1792x1024', // DALL-E 3 horizontal format (legacy)
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
          fileName: `(${videoId}) thumbnail_1.${fileExtension}`,
          style: this.thumbnailStyles.style1.name
        },
        thumbnail2: {
          ...thumbnail2,
          fileName: `(${videoId}) thumbnail_2.${fileExtension}`, 
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
      } catch {
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
      
      // Extract key visual elements (content-focused, not face-focused)
      const visualKeywords = [
        'tools', 'charts', 'graphs', 'data', 'statistics', 'arrows',
        'text', 'typography', 'bold', 'contrast', 'bright',
        'colors', 'vibrant', 'professional', 'clean', 'minimal',
        'success', 'growth', 'transformation', 'achievement',
        'face', 'faces', 'expression', 'emotion', 'close-up'
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
      
      // Default metaphors if none found (content-focused)
      if (parsedContext.visualMetaphors.length === 0) {
        parsedContext.visualMetaphors = ['relevant symbols', 'content tools', 'value indicators'];
      }
      
      // Extract style-specific information
      if (concepts.includes('style 1') || concepts.includes('content focus')) {
        parsedContext.style1Details = {
          approach: 'content-focused',
          colors: parsedContext.colorSuggestions.slice(0, 2),
          elements: ['relevant visuals', 'content symbols', 'high contrast']
        };
      }
      
      if (concepts.includes('style 2') || concepts.includes('transformation')) {
        parsedContext.style2Details = {
          approach: 'transformation/solution',
          colors: ['blue and white', 'minimal palette'],
          elements: ['before/after visuals', 'solution symbols', 'progress indicators']
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
      
      // Fallback to basic parsing based on title (content-aware)
      return {
        mainTheme: title || 'Valuable Content',
        contentType: 'general',
        keyElements: ['relevant', 'professional', 'clickable'],
        emotionalTone: 'inspiring',
        visualMetaphors: ['content symbols', 'value indicators'],
        colorSuggestions: ['vibrant', 'high contrast'],
        textElements: title || 'Content Focus',
        humanElements: []
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
   * Analyze content type and determine appropriate thumbnail approach
   * @private
   */
  analyzeContentType(title, scriptContent) {
    const content = `${title} ${scriptContent}`.toLowerCase();
    
    // Content type analysis - determines visual approach
    const contentTypes = {
      planning: {
        keywords: ['plan', 'planning', 'strategy', 'organize', 'schedule', 'workflow', 'system', 'method'],
        visualElements: ['calendars', 'checklists', 'charts', 'diagrams', 'organized workspace'],
        humanAppropriate: false,
        focusType: 'tools_and_systems'
      },
      educational: {
        keywords: ['learn', 'tutorial', 'guide', 'how to', 'tips', 'tricks', 'course', 'lesson'],
        visualElements: ['books', 'screens', 'diagrams', 'step indicators', 'knowledge symbols'],
        humanAppropriate: false,
        focusType: 'knowledge_transfer'
      },
      business: {
        keywords: ['business', 'money', 'profit', 'investment', 'marketing', 'sales', 'growth', 'success'],
        visualElements: ['graphs', 'charts', 'money symbols', 'growth arrows', 'business tools'],
        humanAppropriate: true,
        focusType: 'achievement_oriented'
      },
      personal: {
        keywords: ['personal', 'life', 'mindset', 'habits', 'motivation', 'confidence', 'self'],
        visualElements: ['transformation symbols', 'personal items', 'lifestyle elements'],
        humanAppropriate: true,
        focusType: 'personal_transformation'
      },
      technical: {
        keywords: ['code', 'software', 'app', 'tech', 'programming', 'development', 'tools'],
        visualElements: ['screens', 'code', 'devices', 'interfaces', 'technical diagrams'],
        humanAppropriate: false,
        focusType: 'technical_demonstration'
      }
    };
    
    // Find best matching content type
    let bestMatch = { type: 'general', score: 0, config: contentTypes.business };
    
    Object.entries(contentTypes).forEach(([type, config]) => {
      const matchCount = config.keywords.filter(keyword => content.includes(keyword)).length;
      if (matchCount > bestMatch.score) {
        bestMatch = { type, score: matchCount, config };
      }
    });
    
    return {
      contentType: bestMatch.type,
      humanFacesAppropriate: bestMatch.config.humanAppropriate,
      visualElements: bestMatch.config.visualElements,
      focusType: bestMatch.config.focusType,
      matchStrength: bestMatch.score
    };
  }

  /**
   * Generate content-aware context for thumbnails
   * @private
   */
  async generateThumbnailContext(title, scriptContent) {
    try {
      // Safely handle null or undefined scriptContent
      const safeScriptContent = scriptContent || title || 'No content available';
      const contentPreview = safeScriptContent.toString().substring(0, 500);
      
      // Analyze content type first
      const contentAnalysis = this.analyzeContentType(title, contentPreview);
      
      const prompt = `
Analyze this YouTube video content for HIGH-CTR thumbnail generation that MATCHES THE ACTUAL CONTENT:

Title: "${title || 'Unknown Title'}"
Content: "${contentPreview}..."
Content Type Detected: ${contentAnalysis.contentType}
Human Faces Appropriate: ${contentAnalysis.humanFacesAppropriate}
Visual Focus: ${contentAnalysis.focusType}

Return JSON with thumbnail context optimized for this SPECIFIC content type:
{
  "mainTheme": "Core value proposition/benefit from the actual content",
  "contentType": "${contentAnalysis.contentType}",
  "emotionalHook": "Primary emotional trigger relevant to content type",
  "humanElements": ${contentAnalysis.humanFacesAppropriate ? '["appropriate facial expression if relevant"]' : '[]'},
  "visualElements": {
    "primary": "Main visual that represents the actual content topic",
    "secondary": "Supporting visual elements from the content domain",
    "contentSymbols": "Visual metaphors specific to this content type"
  },
  "colorPsychology": {
    "primary": "High-contrast color with hex code appropriate for content type",
    "accent": "Text/element color with hex code",
    "emotion": "Psychological impact relevant to content"
  },
  "contentSpecific": ["visual elements from ${contentAnalysis.visualElements.join(', ')}"],
  "transformationAspect": "Before vs after angle specific to this content type",
  "mobileClarifty": "Key content-relevant elements visible at thumbnail size"
}

FOCUS ON CONTENT RELEVANCE: Make thumbnails visually represent what the video is actually about, not generic psychology.`;

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
      // eslint-disable-next-line no-control-regex
      responseText = responseText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      const parsedContext = JSON.parse(responseText);
      
      // Validate parsed context has required fields for content-aware generation
      const validatedContext = {
        mainTheme: parsedContext.mainTheme || title || 'Valuable Content',
        contentType: parsedContext.contentType || 'general',
        emotionalHook: parsedContext.emotionalHook || 'compelling benefit',
        humanElements: Array.isArray(parsedContext.humanElements) ? parsedContext.humanElements : [],
        visualElements: parsedContext.visualElements || {
          primary: 'Content-relevant symbol',
          secondary: 'Supporting imagery', 
          contentSymbols: 'Topic-specific visuals'
        },
        colorPsychology: parsedContext.colorPsychology || {
          primary: '#1e3a8a',
          accent: '#fb923c',
          emotion: 'trust and energy'
        },
        contentSpecific: Array.isArray(parsedContext.contentSpecific) ? parsedContext.contentSpecific : ['relevant visual elements'],
        transformationAspect: parsedContext.transformationAspect || 'problem to solution',
        mobileClarifty: parsedContext.mobileClarifty || 'main content elements visible'
      };
      
      return validatedContext;
      
    } catch (error) {
      logger.warn('Failed to generate thumbnail context, using intelligent fallback:', error.message);
      
      // Enhanced fallback context using content-aware principles
      const safeTitle = title || 'Unknown Content';
      const contentAnalysis = this.analyzeContentType(safeTitle, '');
      
      let emotionalHook = 'breakthrough';
      let humanElements = [];
      let colorPsychology = { primary: '#1e3a8a', accent: '#fb923c', emotion: 'trust and energy' };
      let contentSpecific = ['relevant visual elements'];
      let visualElements = { primary: 'Content symbol', secondary: 'Supporting imagery', contentSymbols: 'Topic-specific visuals' };
      
      // Content-based optimization (not forced psychology)
      const titleLower = safeTitle.toLowerCase();
      if (titleLower.includes('money') || titleLower.includes('rich') || titleLower.includes('wealth')) {
        emotionalHook = 'wealth achievement';
        humanElements = contentAnalysis.humanFacesAppropriate ? ['success expression'] : [];
        colorPsychology = { primary: '#166534', accent: '#fbbf24', emotion: 'wealth and success' };
        contentSpecific = ['dollar symbols', 'growth charts', 'financial graphics'];
        visualElements = { primary: 'Wealth symbols', secondary: 'Money charts', contentSymbols: 'Financial success visuals' };
      } else if (titleLower.includes('plan') || titleLower.includes('strategy') || titleLower.includes('method')) {
        emotionalHook = 'organized success';
        humanElements = []; // Planning content doesn't need faces
        colorPsychology = { primary: '#1e3a8a', accent: '#fb923c', emotion: 'trust and organization' };
        contentSpecific = ['calendars', 'checklists', 'planning tools', 'organized workspace'];
        visualElements = { primary: 'Planning tools', secondary: 'Organization systems', contentSymbols: 'Strategy visuals' };
      } else if (titleLower.includes('secret') || titleLower.includes('hidden') || titleLower.includes('revealed')) {
        emotionalHook = 'revelation';
        humanElements = contentAnalysis.humanFacesAppropriate ? ['surprised expression'] : [];
        colorPsychology = { primary: '#7c2d12', accent: '#fbbf24', emotion: 'mystery and revelation' };
        contentSpecific = ['lock symbols', 'key imagery', 'hidden elements'];
        visualElements = { primary: 'Mystery symbols', secondary: 'Revelation imagery', contentSymbols: 'Hidden knowledge visuals' };
      } else if (titleLower.includes('learn') || titleLower.includes('how') || titleLower.includes('guide')) {
        emotionalHook = 'knowledge mastery';
        humanElements = []; // Educational content focuses on learning materials
        colorPsychology = { primary: '#1d4ed8', accent: '#f59e0b', emotion: 'authority and learning' };
        contentSpecific = ['books', 'screens', 'learning tools', 'educational symbols'];
        visualElements = { primary: 'Learning materials', secondary: 'Knowledge tools', contentSymbols: 'Educational visuals' };
      }
      
      return {
        mainTheme: safeTitle,
        contentType: contentAnalysis.contentType,
        emotionalHook,
        humanElements,
        visualElements,
        colorPsychology,
        contentSpecific,
        transformationAspect: 'problem to solution',
        mobileClarifty: contentAnalysis.humanFacesAppropriate ? 'face and main elements visible' : 'main content elements clearly visible'
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
    
    // Create content-aware thumbnail prompt
    const humanFacesNeeded = context.humanElements && context.humanElements.length > 0;
    const contentType = context.contentType || 'general';
    const contentElements = context.contentSpecific || context.visualElements || [];
    
    const baseThumbnailPrompt = `
Create a HIGH-CTR YouTube thumbnail that VISUALLY REPRESENTS the actual video content.

VIDEO CONTEXT:
- Title: "${title}"
- Content Type: ${contentType}
- Value Proposition: ${context.mainTheme || 'Valuable Content'}
- Emotional Hook: ${context.emotionalHook || 'Compelling Benefit'}
${humanFacesNeeded ? `- Human Element: ${context.humanElements.join(', ')}` : '- Human Element: Not required for this content type'}
- Visual Focus: ${context.visualElements?.primary || 'Content-specific imagery'}
- Supporting Elements: ${context.visualElements?.secondary || 'Relevant symbols'}

CONTENT-SPECIFIC REQUIREMENTS:
${humanFacesNeeded ? 
    '🎯 HUMAN ELEMENT: Include relevant human expression if it enhances content understanding' : 
    '🎯 CONTENT FOCUS: Prioritize visual elements that represent the actual topic'}
🎯 RELEVANCE: Visual elements must relate directly to the video subject matter
🎯 CLARITY: Instantly communicate what the video is about through imagery
🎯 CURIOSITY: Create intrigue about the specific content, not generic emotions
🎯 VALUE PREVIEW: Show glimpses of what viewers will learn or gain

CONTENT-APPROPRIATE VISUALS:
${Array.isArray(contentElements) ? contentElements.map(el => `- ${el}`).join('\n') : `- ${contentElements}`}
- Visual metaphors specific to ${contentType} content
- Tools, symbols, or elements viewers associate with this topic
- Before/after or problem/solution relevant to the specific content

HIGH-CTR COLOR PSYCHOLOGY:
- PRIMARY: ${context.colorPsychology?.primary || 'Deep blue (#1e3a8a)'} for trust/authority
- ACCENT: ${context.colorPsychology?.accent || 'Bright orange (#fb923c)'} for energy/attention
- CONTRAST RATIO: Minimum 7:1 for mobile readability
- SATURATION: High saturation colors that pop in feeds

TECHNICAL SPECIFICATIONS:
- CANVAS: FULL edge-to-edge usage, NO PADDING/BORDERS, NO EMPTY SPACE
- MOBILE FIRST: Clear visual storytelling at 156x88px thumbnail size
- NO TEXT OVERLAYS: Pure visual communication without written content
- COMPOSITION: Position most important content elements prominently

MOBILE OPTIMIZATION CRITICAL:
- ${context.mobileClarifty || 'Main content elements clearly visible at thumbnail size'}
- Visual hierarchy guides eye to most important element
- Distinguishable from other videos in crowded feed
- Instantly recognizable content category

ABSOLUTE REQUIREMENTS:
- NO TEXT OVERLAYS OR WRITTEN CONTENT whatsoever
- FULL CANVAS COVERAGE edge-to-edge with NO EMPTY SPACE
- Content must fill entire image area completely
- MUST visually represent the actual video topic, not generic success imagery

Create a thumbnail that immediately shows what the video is about and compels clicks through relevant, content-specific visual storytelling.`;

    // Enhance with Claude Sonnet (85% cheaper than GPT-4o, no caching needed!)
    logger.info(`🧠 Enhancing base thumbnail prompt with Claude Sonnet for ${videoId}...`);
    const enhancedPrompt = await this.aiService.enhancePromptWithClaudeSonnet(baseThumbnailPrompt, {
      videoId,
      isThumbnail: true,
      size: this.thumbnailSpecs.leonardoSize,
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
    
    // Use the enhanced base prompt directly (Claude already optimized it for Leonardo AI)
    // Style requirements are integrated into Claude enhancement to stay within Leonardo's character limits
    const styledPrompt = enhancedBasePrompt;

    // Generate image using existing AI service WITHOUT Claude enhancement (already enhanced)
    const imageResult = await this.aiService.generateImage(styledPrompt, {
      size: this.thumbnailSpecs.leonardoSize,
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
                  
                  // Look for existing 'Generated Thumbnails' subfolder
                  thumbnailFolder = await this.findExistingThumbnailFolder(parentFolderId);
                  
                  if (!thumbnailFolder) {
                    logger.info('🖼️ \'Generated Thumbnails\' folder not found, creating in existing video folder');
                    thumbnailFolder = await this.findOrCreateThumbnailFolder(parentFolderId);
                  } else {
                    logger.info('🖼️ Using existing \'Generated Thumbnails\' folder in video directory');
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
        
        // Use (VID-XXXX) Title format as standard
        const rawTitle = videoTitle.trim(); // Also try with minimal sanitization
        const rawTitleWithSpace = videoTitle; // Keep original spacing
        const possibleFolderNames = [
          `(${videoId}) ${rawTitleWithSpace}`, // CORRECT format: "(VID-XXXX) Title" (exact spacing)
          `(${videoId}) ${rawTitle}`,        // CORRECT format: "(VID-XXXX) Title" (trimmed)
          `(${videoId}) ${sanitizedTitle}`,  // CORRECT format: "(VID-XXXX) Title" (sanitized)
          `${sanitizedTitle} (${videoId})`   // Legacy format: "Title (VID-XXXX)" (fallback only)
        ];
        
        for (const folderName of possibleFolderNames) {
          try {
            logger.info(`🔍 Trying folder name pattern: "${folderName}"`);
            const existingFolder = await this.findVideoFolder(folderName);
            if (existingFolder) {
              logger.info(`📁 Found existing video folder by name: ${folderName}`);
              videoFolder = existingFolder;
              break; // Stop searching once we find a match
            }
          } catch (findError) {
            logger.warn(`Failed to find folder with pattern "${folderName}": ${findError.message}`);
          }
        }
        
        if (videoFolder) {
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
      }
      
      // LAST RESORT: Create new folder structure only if no existing folder found
      if (!videoFolder) {
        logger.warn(`📁 No existing video folder found for ${videoId}, creating new folder structure as last resort`);
        const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
        // Use CORRECT standard format: "(VID-XXXX) Title"
        const folderName = `(${videoId}) ${sanitizedTitle}`;
        
        logger.info(`📁 Creating new video folder: "${folderName}"`);
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
        logger.info('Found existing \'Generated Thumbnails\' folder in video directory');
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
      logger.info('Creating \'Generated Thumbnails\' subfolder for legacy video');
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
   * Check if thumbnails already exist for a video with retry logic for Google Drive API sync delays
   * @param {string} videoId - Video identifier
   * @param {string} videoTitle - Video title for folder identification
   * @param {number} retryCount - Current retry attempt (for internal use)
   * @returns {Promise<object>} Existing thumbnail information
   */
  async checkExistingThumbnails(videoId, videoTitle, retryCount = 0) {
    try {
      logger.info(`🔍 Checking existing thumbnails for ${videoId}`);
      
      // Find the video folder using (VID-XXXX) Title naming convention
      const sanitizedTitle = this.googleDriveService.sanitizeFolderName(videoTitle);
      const rawTitle = videoTitle.trim(); // Also try with minimal sanitization
      const rawTitleWithSpace = videoTitle; // Keep original spacing
      const possibleFolderNames = [
        `(${videoId}) ${rawTitleWithSpace}`, // CORRECT format: "(VID-XXXX) Title" (exact spacing)
        `(${videoId}) ${rawTitle}`,        // CORRECT format: "(VID-XXXX) Title" (trimmed)
        `(${videoId}) ${sanitizedTitle}`,  // CORRECT format: "(VID-XXXX) Title" (sanitized)
        `${sanitizedTitle} (${videoId})`   // Legacy format: "Title (VID-XXXX)" (fallback only)
      ];
      
      let videoFolder = null;
      for (const folderName of possibleFolderNames) {
        logger.info(`🔍 Checking for existing folder: "${folderName}"`);
        videoFolder = await this.findVideoFolder(folderName);
        if (videoFolder) {
          logger.info(`📁 Found video folder: ${folderName}`);
          break;
        }
      }
      
      if (!videoFolder) {
        return {
          exists: false,
          reason: 'Video folder not found (tried both naming conventions)',
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
      
      // Check for thumbnail files with video ID prefix
      const thumbnailFiles = await this.googleDriveService.drive.files.list({
        q: `parents in '${thumbnailFolder.id}' and (name contains '${videoId}' or name contains 'thumbnail' or name contains '.jpg' or name contains '.png')`,
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
      
      // If no thumbnails found and this is not a retry, wait for Google Drive sync and retry once
      if (!result.exists && retryCount === 0) {
        logger.info(`🔄 No thumbnails found on first check for ${videoId}, retrying after Drive API sync delay...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for Drive API sync
        return this.checkExistingThumbnails(videoId, videoTitle, 1);
      }
      
      if (result.exists) {
        logger.info(`✅ Found ${result.count} existing thumbnails for ${videoId} ${retryCount > 0 ? '(after retry)' : ''}`);
      } else {
        logger.info(`📋 No existing thumbnails found for ${videoId} ${retryCount > 0 ? '(confirmed after retry)' : ''}`);
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
   * Clean up stale processing locks (locks older than 5 minutes)
   * Should be called periodically to prevent memory leaks
   */
  cleanupStaleLocks() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    let cleaned = 0;
    
    for (const [videoId, lockInfo] of this.processingLocks.entries()) {
      if (now - lockInfo.startTime > staleThreshold) {
        this.processingLocks.delete(videoId);
        cleaned++;
        logger.warn(`🧹 Cleaned up stale processing lock for ${videoId} (${Math.round((now - lockInfo.startTime)/1000)}s old)`);
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} stale processing locks`);
    }
    
    return cleaned;
  }

  /**
   * Get current processing status for debugging
   */
  getProcessingStatus() {
    const now = Date.now();
    const activeLocks = Array.from(this.processingLocks.entries()).map(([videoId, lockInfo]) => ({
      videoId,
      age: Math.round((now - lockInfo.startTime) / 1000),
      processId: lockInfo.processId
    }));
    
    return {
      activeLocks: activeLocks.length,
      locks: activeLocks
    };
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
    
    // CRITICAL: Check if another process is already generating thumbnails for this video
    if (this.processingLocks.has(videoId)) {
      const lockInfo = this.processingLocks.get(videoId);
      const waitTime = Date.now() - lockInfo.startTime;
      
      if (waitTime < 300000) { // 5 minutes timeout
        logger.warn(`🔒 Another process is already generating thumbnails for ${videoId} (${Math.round(waitTime/1000)}s ago), skipping to prevent duplication`);
        result.skipped = true;
        result.error = 'Another process is already generating thumbnails for this video';
        result.processingTime = Date.now() - startTime;
        return result;
      } else {
        // Lock is stale (older than 5 minutes), remove it
        logger.warn(`🔓 Removing stale processing lock for ${videoId} (${Math.round(waitTime/1000)}s old)`);
        this.processingLocks.delete(videoId);
      }
    }
    
    // Set processing lock
    this.processingLocks.set(videoId, {
      startTime: Date.now(),
      processId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    try {
      logger.info(`🎨 Starting enhanced thumbnail workflow for ${videoId} (locked)`);
      
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
            fileName: thumbnails.thumbnail1?.fileName || `(${videoId}) thumbnail_1.jpg`,
            upload: uploadResults.uploads?.thumbnail1 || null
          },
          thumbnail2: {
            style: thumbnails.thumbnail2?.style || 'Unknown',
            fileName: thumbnails.thumbnail2?.fileName || `(${videoId}) thumbnail_2.jpg`,
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
    } finally {
      // CRITICAL: Always release the processing lock, even if an error occurred
      if (this.processingLocks.has(videoId)) {
        this.processingLocks.delete(videoId);
        logger.debug(`🔓 Released processing lock for ${videoId}`);
      }
    }
  }
}

export default ThumbnailService;