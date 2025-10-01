/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 process management for the YouTube Automation System.
 * It ensures the main application and asset download scheduler run continuously,
 * restart on failures, and maintain proper resource limits.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs               # Start all processes
 *   pm2 start ecosystem.config.cjs --only main   # Start main app only
 *   pm2 start ecosystem.config.cjs --only asset  # Start asset scheduler only
 *   pm2 stop all                                 # Stop all processes
 *   pm2 restart all                              # Restart all processes
 *   pm2 logs                                     # View logs
 *   pm2 monit                                    # Monitor processes
 */

module.exports = {
  apps: [
    {
      // Main YouTube Automation Application
      name: 'youtube-automation',
      script: './src/index.js',
      instances: 1,
      exec_mode: 'fork',

      // Node.js execution settings
      interpreter: 'node',
      node_args: '--es-module-specifier-resolution=node',

      // Auto-restart settings
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Resource limits
      max_memory_restart: '1G',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        ENABLE_ASSET_SCHEDULER: 'true', // Auto-start asset scheduler
      },

      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        ENABLE_ASSET_SCHEDULER: 'true',
      },

      // Error handling
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      // Merge logs from multiple processes
      merge_logs: true,

      // Enable source map support
      source_map_support: true,

      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: '0 3 * * *',
    },

    {
      // Standalone Asset Download Scheduler (alternative deployment)
      // This can be used if you want to run the scheduler as a separate process
      name: 'asset-scheduler',
      script: './tools/start-asset-scheduler.js',
      args: 'start --daemon',
      instances: 1,
      exec_mode: 'fork',

      // Auto-start disabled by default (scheduler runs in main app)
      autorestart: true,
      autostart: false, // Set to true if you want standalone scheduler
      max_restarts: 10,
      min_uptime: '10s',

      // Resource limits
      max_memory_restart: '512M',

      // Environment
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },

      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
      },

      // Logging
      error_file: './logs/asset-scheduler-error.log',
      out_file: './logs/asset-scheduler-out.log',
      log_file: './logs/asset-scheduler-combined.log',
      time: true,

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      merge_logs: true,
      source_map_support: true,
    }
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deployer',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/youtube_automation.git',
      path: '/var/www/youtube_automation',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': 'apt-get install git'
    },

    development: {
      user: 'deployer',
      host: 'your-dev-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/youtube_automation.git',
      path: '/var/www/youtube_automation_dev',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.cjs --env development'
    }
  }
};
