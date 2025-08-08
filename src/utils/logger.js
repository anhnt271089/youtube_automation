import winston from 'winston';
import { config } from '../../config/config.js';

// Log level icons for better visual identification
const LOG_ICONS = {
  error: '❌',
  warn: '⚠️ ',
  info: '📋',
  debug: '🔧',
  verbose: '📝'
};

// Create a custom timestamp format with GMT+7 timezone (short format)
const bangkokTimestamp = winston.format((info) => {
  info.timestamp = new Date().toLocaleString('en-US', {
    timeZone: config.app.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return info;
});

// Add icon prefix to log messages
const addIconPrefix = winston.format((info) => {
  const icon = LOG_ICONS[info.level] || '📋';
  info.message = `${icon} ${info.message}`;
  return info;
});

const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    bangkokTimestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'youtube-automation' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: winston.format.combine(
        bangkokTimestamp(),
        addIconPrefix(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: winston.format.combine(
        bangkokTimestamp(),
        addIconPrefix(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
  ],
});

if (config.app.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      bangkokTimestamp(),
      addIconPrefix(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${level}]: ${message}${metaStr} ${timestamp}`;
      })
    )
  }));
}

export default logger;