import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Centralized Lock Manager Service to prevent concurrent processing and infinite loops
 * Implements:
 * - Processing locks for videos
 * - Cooldown periods for regeneration
 * - Mutex for cron jobs
 * - Automatic lock cleanup
 */
class LockManagerService {
  constructor() {
    // In-memory lock storage (could be Redis for production)
    this.locks = new Map();
    this.cooldowns = new Map();
    this.cronLocks = new Map();
    
    // Lock timeout configuration (milliseconds)
    this.lockTimeouts = {
      videoProcessing: 10 * 60 * 1000,    // 10 minutes
      scriptGeneration: 5 * 60 * 1000,     // 5 minutes
      imageGeneration: 3 * 60 * 1000,      // 3 minutes
      thumbnailGeneration: 3 * 60 * 1000,  // 3 minutes
      cronJob: 15 * 60 * 1000              // 15 minutes max for cron
    };
    
    // Cooldown periods (milliseconds)
    this.cooldownPeriods = {
      scriptRegeneration: 60 * 60 * 1000,     // 1 hour
      imageRegeneration: 30 * 60 * 1000,      // 30 minutes
      thumbnailRegeneration: 30 * 60 * 1000,  // 30 minutes
      errorRetry: 15 * 60 * 1000              // 15 minutes for error retry
    };
    
    // File-based lock directory for persistence
    this.lockDir = './locks';
    this.ensureLockDirectory();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }
  
  /**
   * Ensure lock directory exists
   */
  ensureLockDirectory() {
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
      logger.info('Lock directory created: ' + this.lockDir);
    }
  }
  
  /**
   * Start cleanup interval to remove stale locks
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupStaleLocks();
    }, 60 * 1000); // Check every minute
  }
  
  /**
   * Clean up stale locks that have exceeded their timeout
   */
  cleanupStaleLocks() {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean in-memory locks
    for (const [key, lock] of this.locks.entries()) {
      if (now - lock.timestamp > lock.timeout) {
        this.locks.delete(key);
        cleaned++;
        logger.warn(`Cleaned stale lock: ${key} (exceeded ${lock.timeout}ms timeout)`);
      }
    }
    
    // Clean file-based locks
    try {
      const files = fs.readdirSync(this.lockDir);
      for (const file of files) {
        if (file.endsWith('.lock')) {
          const lockPath = path.join(this.lockDir, file);
          const stats = fs.statSync(lockPath);
          const age = now - stats.mtimeMs;
          
          // Remove locks older than 1 hour
          if (age > 60 * 60 * 1000) {
            fs.unlinkSync(lockPath);
            cleaned++;
            logger.warn(`Cleaned stale file lock: ${file} (age: ${Math.round(age / 1000)}s)`);
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning file locks:', error);
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} stale locks`);
    }
  }
  
  /**
   * Acquire a processing lock for a video
   * @param {string} videoId - Video ID
   * @param {string} lockType - Type of lock (videoProcessing, scriptGeneration, etc.)
   * @param {Object} metadata - Additional metadata for the lock
   * @returns {boolean} - True if lock acquired, false if already locked
   */
  async acquireLock(videoId, lockType = 'videoProcessing', metadata = {}) {
    const lockKey = `${lockType}:${videoId}`;
    
    // Check if lock already exists
    if (this.locks.has(lockKey)) {
      const existingLock = this.locks.get(lockKey);
      const age = Date.now() - existingLock.timestamp;
      
      // Check if lock is stale
      if (age > existingLock.timeout) {
        logger.warn(`Lock ${lockKey} is stale (age: ${age}ms), releasing and re-acquiring`);
        this.releaseLock(videoId, lockType);
      } else {
        logger.warn(`Lock already exists for ${lockKey}, held by: ${existingLock.holder}, age: ${age}ms`);
        return false;
      }
    }
    
    // Create new lock
    const lock = {
      videoId,
      lockType,
      timestamp: Date.now(),
      timeout: this.lockTimeouts[lockType] || this.lockTimeouts.videoProcessing,
      holder: metadata.holder || 'system',
      processId: process.pid,
      metadata
    };
    
    this.locks.set(lockKey, lock);
    
    // Also create file-based lock for persistence
    this.createFileLock(lockKey, lock);
    
    logger.info(`Lock acquired: ${lockKey} by ${lock.holder}`);
    return true;
  }
  
  /**
   * Release a processing lock
   * @param {string} videoId - Video ID
   * @param {string} lockType - Type of lock
   */
  releaseLock(videoId, lockType = 'videoProcessing') {
    const lockKey = `${lockType}:${videoId}`;
    
    if (this.locks.has(lockKey)) {
      const lock = this.locks.get(lockKey);
      const duration = Date.now() - lock.timestamp;
      this.locks.delete(lockKey);
      
      // Remove file-based lock
      this.removeFileLock(lockKey);
      
      logger.info(`Lock released: ${lockKey}, held for ${duration}ms`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a video is locked
   * @param {string} videoId - Video ID
   * @param {string} lockType - Type of lock
   * @returns {boolean} - True if locked
   */
  isLocked(videoId, lockType = 'videoProcessing') {
    const lockKey = `${lockType}:${videoId}`;
    
    if (this.locks.has(lockKey)) {
      const lock = this.locks.get(lockKey);
      const age = Date.now() - lock.timestamp;
      
      // Check if lock is stale
      if (age > lock.timeout) {
        logger.warn(`Lock ${lockKey} is stale, considering as unlocked`);
        this.releaseLock(videoId, lockType);
        return false;
      }
      
      return true;
    }
    
    // Check file-based lock as backup
    return this.hasFileLock(lockKey);
  }
  
  /**
   * Get lock info
   * @param {string} videoId - Video ID
   * @param {string} lockType - Type of lock
   * @returns {Object|null} - Lock information or null
   */
  getLockInfo(videoId, lockType = 'videoProcessing') {
    const lockKey = `${lockType}:${videoId}`;
    return this.locks.get(lockKey) || null;
  }
  
  /**
   * Check if a regeneration is in cooldown
   * @param {string} videoId - Video ID
   * @param {string} cooldownType - Type of cooldown (scriptRegeneration, imageRegeneration, etc.)
   * @returns {Object} - {inCooldown: boolean, remainingTime: number}
   */
  checkCooldown(videoId, cooldownType) {
    const cooldownKey = `${cooldownType}:${videoId}`;
    const cooldown = this.cooldowns.get(cooldownKey);
    
    if (!cooldown) {
      return { inCooldown: false, remainingTime: 0 };
    }
    
    const now = Date.now();
    const elapsed = now - cooldown.timestamp;
    const period = this.cooldownPeriods[cooldownType] || this.cooldownPeriods.errorRetry;
    
    if (elapsed >= period) {
      // Cooldown expired
      this.cooldowns.delete(cooldownKey);
      return { inCooldown: false, remainingTime: 0 };
    }
    
    return {
      inCooldown: true,
      remainingTime: period - elapsed,
      expiresAt: new Date(cooldown.timestamp + period)
    };
  }
  
  /**
   * Set a cooldown for regeneration
   * @param {string} videoId - Video ID
   * @param {string} cooldownType - Type of cooldown
   * @param {Object} metadata - Additional metadata
   */
  setCooldown(videoId, cooldownType, metadata = {}) {
    const cooldownKey = `${cooldownType}:${videoId}`;
    const period = this.cooldownPeriods[cooldownType] || this.cooldownPeriods.errorRetry;
    
    const cooldown = {
      videoId,
      cooldownType,
      timestamp: Date.now(),
      period,
      expiresAt: new Date(Date.now() + period),
      metadata
    };
    
    this.cooldowns.set(cooldownKey, cooldown);
    
    logger.info(`Cooldown set for ${cooldownKey}, expires in ${period}ms at ${cooldown.expiresAt}`);
    return cooldown;
  }
  
  /**
   * Clear a cooldown
   * @param {string} videoId - Video ID
   * @param {string} cooldownType - Type of cooldown
   */
  clearCooldown(videoId, cooldownType) {
    const cooldownKey = `${cooldownType}:${videoId}`;
    
    if (this.cooldowns.has(cooldownKey)) {
      this.cooldowns.delete(cooldownKey);
      logger.info(`Cooldown cleared for ${cooldownKey}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Acquire a cron job mutex to prevent overlapping execution
   * @param {string} jobName - Name of the cron job
   * @returns {boolean} - True if mutex acquired
   */
  acquireCronMutex(jobName) {
    if (this.cronLocks.has(jobName)) {
      const lock = this.cronLocks.get(jobName);
      const age = Date.now() - lock.timestamp;
      
      // Check if lock is stale (older than timeout)
      if (age > this.lockTimeouts.cronJob) {
        logger.warn(`Cron mutex ${jobName} is stale (age: ${age}ms), releasing and re-acquiring`);
        this.releaseCronMutex(jobName);
      } else {
        logger.warn(`Cron job ${jobName} is already running (started ${age}ms ago)`);
        return false;
      }
    }
    
    const lock = {
      jobName,
      timestamp: Date.now(),
      processId: process.pid
    };
    
    this.cronLocks.set(jobName, lock);
    logger.info(`Cron mutex acquired for ${jobName}`);
    return true;
  }
  
  /**
   * Release a cron job mutex
   * @param {string} jobName - Name of the cron job
   */
  releaseCronMutex(jobName) {
    if (this.cronLocks.has(jobName)) {
      const lock = this.cronLocks.get(jobName);
      const duration = Date.now() - lock.timestamp;
      this.cronLocks.delete(jobName);
      logger.info(`Cron mutex released for ${jobName}, ran for ${duration}ms`);
      return true;
    }
    return false;
  }
  
  /**
   * Create a file-based lock for persistence
   * @param {string} lockKey - Lock key
   * @param {Object} lockData - Lock data
   */
  createFileLock(lockKey, lockData) {
    try {
      const filename = lockKey.replace(/:/g, '_') + '.lock';
      const lockPath = path.join(this.lockDir, filename);
      fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));
    } catch (error) {
      logger.error(`Failed to create file lock for ${lockKey}:`, error);
    }
  }
  
  /**
   * Remove a file-based lock
   * @param {string} lockKey - Lock key
   */
  removeFileLock(lockKey) {
    try {
      const filename = lockKey.replace(/:/g, '_') + '.lock';
      const lockPath = path.join(this.lockDir, filename);
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch (error) {
      logger.error(`Failed to remove file lock for ${lockKey}:`, error);
    }
  }
  
  /**
   * Check if a file-based lock exists
   * @param {string} lockKey - Lock key
   * @returns {boolean} - True if lock exists
   */
  hasFileLock(lockKey) {
    try {
      const filename = lockKey.replace(/:/g, '_') + '.lock';
      const lockPath = path.join(this.lockDir, filename);
      return fs.existsSync(lockPath);
    } catch (error) {
      logger.error(`Failed to check file lock for ${lockKey}:`, error);
      return false;
    }
  }
  
  /**
   * Get all active locks
   * @returns {Array} - Array of active locks
   */
  getAllLocks() {
    const locks = [];
    
    for (const [key, lock] of this.locks.entries()) {
      const age = Date.now() - lock.timestamp;
      locks.push({
        ...lock,
        key,
        age,
        isStale: age > lock.timeout
      });
    }
    
    return locks;
  }
  
  /**
   * Get all active cooldowns
   * @returns {Array} - Array of active cooldowns
   */
  getAllCooldowns() {
    const cooldowns = [];
    const now = Date.now();
    
    for (const [key, cooldown] of this.cooldowns.entries()) {
      const elapsed = now - cooldown.timestamp;
      const remaining = cooldown.period - elapsed;
      
      cooldowns.push({
        ...cooldown,
        key,
        elapsed,
        remaining,
        isExpired: remaining <= 0
      });
    }
    
    return cooldowns;
  }
  
  /**
   * Get all active cron mutexes
   * @returns {Array} - Array of active cron mutexes
   */
  getAllCronMutexes() {
    const mutexes = [];
    
    for (const [jobName, lock] of this.cronLocks.entries()) {
      const age = Date.now() - lock.timestamp;
      mutexes.push({
        ...lock,
        jobName,
        age,
        isStale: age > this.lockTimeouts.cronJob
      });
    }
    
    return mutexes;
  }
  
  /**
   * Clear all locks and cooldowns (for emergency use)
   */
  clearAll() {
    const lockCount = this.locks.size;
    const cooldownCount = this.cooldowns.size;
    const cronCount = this.cronLocks.size;
    
    this.locks.clear();
    this.cooldowns.clear();
    this.cronLocks.clear();
    
    // Clear file locks
    try {
      const files = fs.readdirSync(this.lockDir);
      for (const file of files) {
        if (file.endsWith('.lock')) {
          fs.unlinkSync(path.join(this.lockDir, file));
        }
      }
    } catch (error) {
      logger.error('Error clearing file locks:', error);
    }
    
    logger.warn(`EMERGENCY CLEAR: Removed ${lockCount} locks, ${cooldownCount} cooldowns, ${cronCount} cron mutexes`);
    return { lockCount, cooldownCount, cronCount };
  }
  
  /**
   * Get status summary
   * @returns {Object} - Status summary
   */
  getStatus() {
    return {
      locks: {
        active: this.locks.size,
        details: this.getAllLocks()
      },
      cooldowns: {
        active: this.cooldowns.size,
        details: this.getAllCooldowns()
      },
      cronMutexes: {
        active: this.cronLocks.size,
        details: this.getAllCronMutexes()
      },
      configuration: {
        lockTimeouts: this.lockTimeouts,
        cooldownPeriods: this.cooldownPeriods
      }
    };
  }
}

// Export singleton instance
const lockManager = new LockManagerService();
export default lockManager;