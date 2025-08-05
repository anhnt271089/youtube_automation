// Production-specific configuration
export const productionConfig = {
  // Production cron schedules (as specified in README)
  cronSchedules: {
    processNewVideos: '*/10 * * * *',    // Every 10 minutes
    processApprovedScripts: '*/15 * * * *', // Every 15 minutes
    generateVideos: '*/20 * * * *',      // Every 20 minutes
    approvalTimeouts: '0 * * * *',       // Every hour
    healthCheck: '0 */6 * * *',          // Every 6 hours
    dailySummary: '0 9 * * *'            // 9 AM daily
  },

  // Production logging
  logging: {
    level: 'info',
    console: false,
    file: true
  },

  // Production limits
  processing: {
    maxConcurrentVideos: 4,
    maxRetries: 3,
    timeoutMs: 120000 // 2 minutes
  },

  // Production AI settings
  ai: {
    model: 'gpt-4o-mini',
    maxTokens: 4000,
    temperature: 0.7
  }
};

export default productionConfig;