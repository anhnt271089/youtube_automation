import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from 'ytdl-core';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

class YouTubeService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: config.youtube.apiKey
    });
  }

  extractVideoId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  parseDuration(isoDuration) {
    if (!isoDuration) return 'Unknown';
    
    // Parse ISO 8601 duration format (PT4M13S -> 4:13)
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'Unknown';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  async getVideoMetadata(videoIdOrUrl) {
    try {
      // Handle both video ID and full URL
      let videoId;
      if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
        videoId = this.extractVideoId(videoIdOrUrl);
      } else {
        // Assume it's already a video ID
        videoId = videoIdOrUrl;
      }
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
      }

      const response = await this.youtube.videos.list({
        part: 'snippet,statistics,contentDetails',
        id: videoId
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      const snippet = video.snippet;
      
      // Parse duration from ISO 8601 format (PT4M13S -> 4:13)
      const duration = this.parseDuration(video.contentDetails?.duration);
      
      return {
        videoId,
        title: snippet?.title || 'Unknown Title',
        description: snippet?.description || '',
        channelTitle: snippet?.channelTitle || 'Unknown Channel',
        publishedAt: snippet?.publishedAt || null,
        thumbnails: snippet?.thumbnails || {},
        duration: duration,
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        likeCount: parseInt(video.statistics?.likeCount || '0'),
        tags: snippet?.tags || [],
        categoryId: snippet?.categoryId || null
      };
    } catch (error) {
      logger.error('Error fetching video metadata:', error);
      throw error;
    }
  }

  async getTranscript(videoIdOrUrl) {
    try {
      // Handle both video ID and full URL
      let videoId;
      if (videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')) {
        videoId = this.extractVideoId(videoIdOrUrl);
      } else {
        videoId = videoIdOrUrl;
      }
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
      }

      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      return transcript.map(item => ({
        text: item.text,
        start: item.offset,
        duration: item.duration
      }));
    } catch (error) {
      logger.error('Error fetching video transcript:', error);
      return null;
    }
  }

  async downloadThumbnail(videoUrl, quality = 'maxresdefault') {
    try {
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
      return thumbnailUrl;
    } catch (error) {
      logger.error('Error getting thumbnail URL:', error);
      throw error;
    }
  }

  async getVideoInfo(videoUrl) {
    try {
      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(videoId);
      return {
        videoDetails: info.videoDetails,
        formats: info.formats,
        relatedVideos: info.related_videos
      };
    } catch (error) {
      logger.error('Error fetching video info:', error);
      throw error;
    }
  }

  formatTranscript(transcript) {
    if (!transcript || !Array.isArray(transcript)) {
      return '';
    }
    
    return transcript.map(item => item.text).join(' ');
  }

  async healthCheck() {
    try {
      // Test YouTube API by getting metadata for a known public video
      const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - always available
      const testUrl = `https://www.youtube.com/watch?v=${testVideoId}`;
      
      await this.getVideoMetadata(testUrl);
      logger.info('YouTube service health check passed');
      return true;
    } catch (error) {
      logger.error('YouTube service health check failed:', error);
      throw error;
    }
  }

  async getCompleteVideoData(videoUrl) {
    try {
      logger.info(`Processing video: ${videoUrl}`);
      
      const [metadata, transcript, thumbnailUrl] = await Promise.all([
        this.getVideoMetadata(videoUrl),
        this.getTranscript(videoUrl),
        this.downloadThumbnail(videoUrl)
      ]);

      return {
        ...metadata,
        transcript,
        transcriptText: this.formatTranscript(transcript),
        thumbnailUrl,
        originalUrl: videoUrl
      };
    } catch (error) {
      logger.error('Error getting complete video data:', error);
      throw error;
    }
  }
}

export default YouTubeService;