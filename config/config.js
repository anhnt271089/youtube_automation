import dotenv from 'dotenv';

dotenv.config();

export const config = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
  google: {
    // OAuth Configuration
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    
    // OAuth Tokens
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    
    // Google Services IDs
    masterSheetId: process.env.GOOGLE_MASTER_SHEET_ID,
    templateWorkbookId: process.env.GOOGLE_TEMPLATE_WORKBOOK_ID,
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    videosRootFolderId: process.env.GOOGLE_VIDEOS_ROOT_FOLDER_ID,
    
    // Legacy Service Account (for backwards compatibility)
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, '\n'),
  },
  notion: {
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID,
    // Note: videoDetailsDatabaseId removed - we now create per-video databases dynamically
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY,
    baseUrl: 'https://api.pexels.com/v1',
    searchResultsPerPage: 10,
    downloadTimeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
  },
  assetDownload: {
    // Automatic asset download orchestration settings
    enableAutoDownload: process.env.ENABLE_AUTO_ASSET_DOWNLOAD !== 'false', // Default true
    maxRetries: parseInt(process.env.ASSET_DOWNLOAD_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.ASSET_DOWNLOAD_RETRY_DELAY) || 5000, // 5 seconds
    processingTimeout: parseInt(process.env.ASSET_DOWNLOAD_TIMEOUT) || 300000, // 5 minutes
    delayBetweenProcessing: parseInt(process.env.ASSET_DOWNLOAD_DELAY) || 2000, // 2 seconds between assets
    cooldownPeriodMinutes: parseInt(process.env.ASSET_DOWNLOAD_COOLDOWN) || 15, // 15 minutes between retries for same video
    maxConcurrentProcessing: parseInt(process.env.ASSET_DOWNLOAD_MAX_CONCURRENT) || 2, // Max videos processing simultaneously
    enableStatusUpdates: process.env.ENABLE_ASSET_STATUS_UPDATES !== 'false', // Default true - update workflow status
    enableNotifications: process.env.ENABLE_ASSET_NOTIFICATIONS !== 'false', // Default true - Telegram notifications
  },
  assetDownloadScheduler: {
    // Cron-based scheduler for automatic asset downloads (reliable fallback system)
    enabled: process.env.ASSET_SCHEDULER_ENABLED !== 'false', // Default true
    cronPattern: process.env.ASSET_SCHEDULER_CRON_PATTERN || '*/7 * * * *', // Every 7 minutes default
    maxConcurrentProcessing: parseInt(process.env.ASSET_SCHEDULER_MAX_CONCURRENT) || 3, // Max videos processing simultaneously
    processingTimeout: parseInt(process.env.ASSET_SCHEDULER_TIMEOUT) || 600000, // 10 minutes per video
    cooldownPeriodMinutes: parseInt(process.env.ASSET_SCHEDULER_COOLDOWN) || 30, // 30 minutes between retries for same video
    enableRetryLogic: process.env.ASSET_SCHEDULER_ENABLE_RETRY !== 'false', // Default true
    maxRetryAttempts: parseInt(process.env.ASSET_SCHEDULER_MAX_RETRIES) || 3,
    enableStatusTracking: process.env.ASSET_SCHEDULER_STATUS_TRACKING !== 'false', // Default true
    enableHealthChecks: process.env.ASSET_SCHEDULER_HEALTH_CHECKS !== 'false', // Default true
    enableNotifications: process.env.ASSET_SCHEDULER_NOTIFICATIONS !== 'false', // Default true - Telegram notifications for scheduler events
  },
  leonardo: {
    apiKey: process.env.LEONARDO_API_KEY,
    baseUrl: 'https://cloud.leonardo.ai/api/rest/v1',
    defaultModel: process.env.LEONARDO_DEFAULT_MODEL || 'leonardo-anime',
    defaultPresetStyle: process.env.LEONARDO_PRESET_STYLE || null, // Most models don't use preset styles anymore
    enableAlchemy: process.env.LEONARDO_ENABLE_ALCHEMY !== 'false', // Default true for better quality
    creditsPerGeneration: parseInt(process.env.LEONARDO_CREDITS_PER_GENERATION) || 7, // Estimated cost
    maxRetries: parseInt(process.env.LEONARDO_MAX_RETRIES) || 3,
    requestTimeout: parseInt(process.env.LEONARDO_REQUEST_TIMEOUT) || 60000, // 60 seconds
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    notificationsEnabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false', // Default true for backward compatibility
    requestTimeout: parseInt(process.env.TELEGRAM_REQUEST_TIMEOUT) || 30000, // 30 seconds timeout
    maxRetries: parseInt(process.env.TELEGRAM_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.TELEGRAM_RETRY_DELAY) || 1000, // 1 second initial delay
  },
  // Digital Ocean has been replaced with Google Drive for storage
  transcript: {
    enableFallbacks: process.env.ENABLE_TRANSCRIPT_FALLBACKS !== 'false', // Default true
    enableWhisperFallback: process.env.ENABLE_WHISPER_FALLBACK === 'true', // Default false (costs money)
    enableDescriptionFallback: process.env.ENABLE_DESCRIPTION_FALLBACK !== 'false', // Default true
    enableCommentsAnalysis: process.env.ENABLE_COMMENTS_ANALYSIS === 'true', // Default false (API quota intensive)
    maxAudioDurationMinutes: parseInt(process.env.MAX_AUDIO_DURATION_MINUTES) || 15, // Max 15 min for Whisper
    fallbackMethods: (process.env.TRANSCRIPT_FALLBACK_METHODS || 'alternative-libs,description,comments').split(','),
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    concurrentWorkers: parseInt(process.env.CONCURRENT_WORKERS) || 4,
    // Image generation toggle settings (default: false to save costs)
    enableImageGeneration: process.env.ENABLE_IMAGE_GENERATION === 'true', // Default false
    enableScriptBreakdown: process.env.ENABLE_SCRIPT_BREAKDOWN === 'true', // Default false
    imageGenerationLimit: parseInt(process.env.IMAGE_GENERATION_LIMIT) || 0, // 0 = no limit
    autoApproveScripts: process.env.AUTO_APPROVE_SCRIPTS === 'true', // Default false
    // Script length control
    maxScriptSentences: parseInt(process.env.MAX_SCRIPT_SENTENCES) || 60, // Default 60 sentences for ~5 min videos
    // YouTube thumbnail generation settings
    enableThumbnailGeneration: process.env.ENABLE_THUMBNAIL_GENERATION === 'true', // Default false unless explicitly enabled
    thumbnailCount: parseInt(process.env.THUMBNAIL_COUNT) || 2, // Number of thumbnails to generate
    thumbnailFormat: process.env.THUMBNAIL_FORMAT || 'JPG', // PNG or JPG
    thumbnailQuality: process.env.THUMBNAIL_QUALITY || 'standard', // Standard quality for Leonardo AI
    // Thumbnail optimization settings
    enableThumbnailConceptGeneration: process.env.ENABLE_THUMBNAIL_CONCEPT_GENERATION !== 'false', // Default true
    thumbnailProcessingMode: process.env.THUMBNAIL_PROCESSING_MODE || 'smart', // smart|immediate|batch
    // Timezone configuration for cron jobs
    timezone: process.env.TIMEZONE || 'Asia/Bangkok', // GMT+7
    // Image generation settings
    imageAspectRatio: process.env.IMAGE_ASPECT_RATIO || '16:9', // YouTube video format
    imageWidth: parseInt(process.env.IMAGE_WIDTH) || 1920,
    imageHeight: parseInt(process.env.IMAGE_HEIGHT) || 1080,
    imageModel: process.env.IMAGE_MODEL || 'leonardo-anime', // leonardo-anime, leonardo-phoenix, leonardo-vision-xl (Leonardo AI only)
    imageProvider: 'leonardo', // Fixed to Leonardo AI only
    enhancePromptsWithClaudeSonnet: process.env.ENHANCE_PROMPTS_WITH_CLAUDE_SONNET !== 'false', // Default true - use Claude Sonnet for Leonardo AI prompt optimization (85% cheaper!)
    costTrackingEnabled: process.env.COST_TRACKING_ENABLED !== 'false',
    maxImageCostPerVideo: parseFloat(process.env.MAX_IMAGE_COST_PER_VIDEO) || 1.50, // $1.50 budget
    // Interactive Content Generation Settings
    useInteractiveGeneration: process.env.USE_INTERACTIVE_GENERATION === 'true', // Default false
    interactiveContentTypes: (process.env.INTERACTIVE_CONTENT_TYPES || '').split(',').filter(Boolean), // script,thumbnails,description,title
    fallbackToAPI: process.env.FALLBACK_TO_API !== 'false', // Default true - fallback to API if interactive fails
    interactiveGenerationTimeout: parseInt(process.env.INTERACTIVE_GENERATION_TIMEOUT) || 3600000, // 1 hour default
    queueCleanupInterval: parseInt(process.env.QUEUE_CLEANUP_INTERVAL) || 604800000, // 7 days default
    enableQueuePrioritization: process.env.ENABLE_QUEUE_PRIORITIZATION !== 'false', // Default true
  }
};

export const validateConfig = () => {
  const required = [
    'YOUTUBE_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_ACCESS_TOKEN',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_MASTER_SHEET_ID',
    'GOOGLE_TEMPLATE_WORKBOOK_ID',
    'GOOGLE_VIDEOS_ROOT_FOLDER_ID',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];

  // Optional but recommended
  const recommended = [
    'OPENAI_API_KEY', // For AI content generation (GPT-4o mini for script breakdown)
    'ANTHROPIC_API_KEY', // For Claude Sonnet AI enhancement
    'LEONARDO_API_KEY', // For Leonardo AI image generation (required)
    'PEXELS_API_KEY', // For Pexels asset download functionality
  ];

  const missing = required.filter(key => !process.env[key]);
  const missingRecommended = recommended.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (missingRecommended.length > 0) {
    // Use console.warn directly to avoid circular dependency with logger
    console.warn(`⚠️  Missing optional environment variables: ${missingRecommended.join(', ')}`);
    console.warn('Some features may not work without these configurations.');
  }
  
  return true;
};