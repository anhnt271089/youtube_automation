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
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  digitalOcean: {
    endpoint: process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com',
    region: process.env.DO_SPACES_REGION || 'nyc3',
    accessKey: process.env.DO_SPACES_ACCESS_KEY,
    secretKey: process.env.DO_SPACES_SECRET_KEY,
    bucketName: process.env.DO_SPACES_BUCKET_NAME,
    cdnUrl: process.env.DO_SPACES_CDN_URL, // Optional CDN endpoint
  },
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
    // Timezone configuration for cron jobs
    timezone: process.env.TIMEZONE || 'Asia/Bangkok', // GMT+7
    // Image generation settings
    imageAspectRatio: process.env.IMAGE_ASPECT_RATIO || '16:9', // YouTube video format
    imageWidth: parseInt(process.env.IMAGE_WIDTH) || 1920,
    imageHeight: parseInt(process.env.IMAGE_HEIGHT) || 1080,
    imageModel: process.env.IMAGE_MODEL || 'dall-e-3', // dall-e-2, dall-e-3, stable-diffusion
    costTrackingEnabled: process.env.COST_TRACKING_ENABLED !== 'false',
    maxImageCostPerVideo: parseFloat(process.env.MAX_IMAGE_COST_PER_VIDEO) || 1.50, // $1.50 budget
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
    'OPENAI_API_KEY', // For AI content generation
    'ANTHROPIC_API_KEY', // For AI fallback
    'DO_SPACES_ACCESS_KEY', // For image storage
    'DO_SPACES_SECRET_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  const missingRecommended = recommended.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (missingRecommended.length > 0) {
    console.warn(`⚠️  Missing optional environment variables: ${missingRecommended.join(', ')}`);
    console.warn('Some features may not work without these configurations.');
  }
  
  return true;
};