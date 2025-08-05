// Development-specific configuration overrides
export const developmentConfig = {
  // Shorter intervals for development testing
  cronSchedules: {
    processNewVideos: '*/2 * * * *',     // Every 2 minutes
    processApprovedScripts: '*/3 * * * *', // Every 3 minutes
    generateVideos: '*/5 * * * *',       // Every 5 minutes
    healthCheck: '*/30 * * * *',         // Every 30 minutes
    dailySummary: '0 9 * * *'            // 9 AM daily
  },

  // Development logging
  logging: {
    level: 'debug',
    console: true,
    file: true
  },

  // Development limits
  processing: {
    maxConcurrentVideos: 2,
    maxRetries: 2,
    timeoutMs: 30000
  },

  // Development AI settings
  ai: {
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.7
  }
};

export default developmentConfig;