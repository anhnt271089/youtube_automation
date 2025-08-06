import dotenv from 'dotenv';

dotenv.config();

export const config = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
  google: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
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
  }
};

export const validateConfig = () => {
  const required = [
    'YOUTUBE_API_KEY',
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    // Note: NOTION_VIDEO_DETAILS_DATABASE_ID removed - we create per-video databases dynamically
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
};