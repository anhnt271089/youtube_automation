import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

class StatusCacheService {
  constructor() {
    this.cacheFile = path.join(process.cwd(), 'temp', 'video_status_cache.json');
    this.ensureCacheDirectory();
  }

  /**
   * Ensure cache directory exists
   */
  ensureCacheDirectory() {
    const cacheDir = path.dirname(this.cacheFile);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      logger.info(`Created cache directory: ${cacheDir}`);
    }
  }

  /**
   * Load cached status data from file
   */
  loadCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        logger.info('No cache file found, starting with empty cache');
        return {
          videos: [],
          lastUpdate: null
        };
      }

      const cacheData = fs.readFileSync(this.cacheFile, 'utf8');
      const parsed = JSON.parse(cacheData);
      
      logger.info(`Loaded cache with ${parsed.videos?.length || 0} videos, last update: ${parsed.lastUpdate}`);
      return parsed;
    } catch (error) {
      logger.warn('Failed to load cache file, starting with empty cache:', error.message);
      return {
        videos: [],
        lastUpdate: null
      };
    }
  }

  /**
   * Save status data to cache file
   */
  saveCache(videos) {
    try {
      const cacheData = {
        videos: videos,
        lastUpdate: new Date().toISOString()
      };

      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
      logger.info(`Saved cache with ${videos.length} videos at ${cacheData.lastUpdate}`);
      return true;
    } catch (error) {
      logger.error('Failed to save cache file:', error);
      return false;
    }
  }

  /**
   * Get cached videos data
   */
  getCachedVideos() {
    const cache = this.loadCache();
    return cache.videos || [];
  }

  /**
   * Update cache with new videos data
   */
  updateCache(videos) {
    return this.saveCache(videos);
  }

  /**
   * Get last cache update time
   */
  getLastUpdateTime() {
    const cache = this.loadCache();
    return cache.lastUpdate ? new Date(cache.lastUpdate) : null;
  }

  /**
   * Clear cache file
   */
  clearCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
        logger.info('Cache file cleared');
      }
      return true;
    } catch (error) {
      logger.error('Failed to clear cache file:', error);
      return false;
    }
  }

  /**
   * Get cache file statistics
   */
  getCacheStats() {
    try {
      const cache = this.loadCache();
      const stats = {
        exists: fs.existsSync(this.cacheFile),
        videoCount: cache.videos?.length || 0,
        lastUpdate: cache.lastUpdate,
        fileSize: 0
      };

      if (stats.exists) {
        const fileStats = fs.statSync(this.cacheFile);
        stats.fileSize = fileStats.size;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        exists: false,
        videoCount: 0,
        lastUpdate: null,
        fileSize: 0,
        error: error.message
      };
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck() {
    try {
      // Test write access
      const testData = [{ videoId: 'test', title: 'test', timestamp: Date.now() }];
      const saved = this.saveCache(testData);
      
      if (!saved) {
        throw new Error('Failed to write to cache file');
      }

      // Test read access
      const loaded = this.loadCache();
      if (!loaded.videos || loaded.videos.length === 0) {
        throw new Error('Failed to read from cache file');
      }

      // Restore empty cache
      this.saveCache([]);

      return { 
        status: 'healthy', 
        service: 'StatusCache',
        cacheFile: this.cacheFile
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        service: 'StatusCache', 
        error: error.message,
        cacheFile: this.cacheFile
      };
    }
  }
}

export default StatusCacheService;