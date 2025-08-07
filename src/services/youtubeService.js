import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from 'ytdl-core';
import { getSubtitles } from 'youtube-captions-scraper';
import YoutubeTranscriptApi from 'youtube-transcript-api';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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

      logger.info(`Transcript: ${videoId}`);
      
      // Try primary method first
      const transcript = await this.getTranscriptWithFallbacks(videoId);
      return transcript;
    } catch (error) {
      logger.error('Error fetching video transcript:', error);
      return null;
    }
  }

  async getTranscriptWithFallbacks(videoId) {
    const fallbackMethods = config.transcript.enableFallbacks ? 
      config.transcript.fallbackMethods : ['primary'];
    
    logger.info(`Fallbacks: ${fallbackMethods.join(', ')}`);
    
    // Method 1: Primary youtube-transcript library
    if (fallbackMethods.includes('primary') || fallbackMethods.length === 0) {
      try {
        logger.info('Primary method...');
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcript && transcript.length > 0) {
          logger.info(`✅ Primary: ${transcript.length} segments`);
          return transcript.map(item => ({
            text: item.text,
            start: item.offset,
            duration: item.duration
          }));
        }
      } catch (error) {
        logger.warn('Primary failed:', error.message);
      }
    }

    // Method 2: Alternative transcript libraries
    if (fallbackMethods.includes('alternative-libs')) {
      try {
        logger.info('Alternative libraries...');
        const alternativeTranscript = await this.getAlternativeTranscript(videoId);
        if (alternativeTranscript && alternativeTranscript.length > 0) {
          logger.info(`✅ Alt libs: ${alternativeTranscript.length} segments`);
          return alternativeTranscript;
        }
      } catch (error) {
        logger.warn('Alt libs failed:', error.message);
      }
    }

    // Method 3: Whisper API fallback (if enabled)
    if (config.transcript.enableWhisperFallback && fallbackMethods.includes('whisper')) {
      try {
        logger.info('Whisper API...');
        const whisperTranscript = await this.getWhisperTranscript(videoId);
        if (whisperTranscript && whisperTranscript.length > 0) {
          logger.info(`✅ Whisper: ${whisperTranscript.length} segments`);
          return whisperTranscript;
        }
      } catch (error) {
        logger.warn('Whisper failed:', error.message);
      }
    }

    // Method 4: Video description fallback
    if (config.transcript.enableDescriptionFallback && fallbackMethods.includes('description')) {
      try {
        logger.info('Description fallback...');
        const descriptionTranscript = await this.getDescriptionAsTranscript(videoId);
        if (descriptionTranscript && descriptionTranscript.length > 0) {
          logger.info(`✅ Desc: ${descriptionTranscript.length} segments`);
          return descriptionTranscript;
        }
      } catch (error) {
        logger.warn('Description fallback failed:', error.message);
      }
    }

    // Method 5: Comments analysis fallback
    if (config.transcript.enableCommentsAnalysis && fallbackMethods.includes('comments')) {
      try {
        logger.info('Trying comments analysis fallback');
        const commentsTranscript = await this.getCommentsAsTranscript(videoId);
        if (commentsTranscript && commentsTranscript.length > 0) {
          logger.info(`✅ Comments: ${commentsTranscript.length} segments`);
          return commentsTranscript;
        }
      } catch (error) {
        logger.warn('Comments analysis fallback failed:', error.message);
      }
    }

    logger.error('❌ All transcript fallback methods failed');
    return null;
  }

  async getAlternativeTranscript(videoId) {
    const methods = [
      // youtube-captions-scraper
      async () => {
        logger.debug('Trying youtube-captions-scraper');
        const captions = await getSubtitles({
          videoID: videoId,
          lang: 'en'
        });
        return captions.map((item, index) => ({
          text: item.text,
          start: item.start || index * 1000,
          duration: item.dur || 1000
        }));
      },
      // youtube-transcript-api
      async () => {
        logger.debug('Trying youtube-transcript-api');
        const transcriptApi = new YoutubeTranscriptApi();
        const transcript = await transcriptApi.getTranscript(videoId);
        return transcript.map(item => ({
          text: item.text,
          start: item.start || item.offset,
          duration: item.duration
        }));
      }
    ];

    for (let i = 0; i < methods.length; i++) {
      try {
        const result = await methods[i]();
        if (result && result.length > 0) {
          logger.debug(`Alternative method ${i + 1} succeeded`);
          return result;
        }
      } catch (error) {
        logger.debug(`Alternative method ${i + 1} failed:`, error.message);
      }
    }

    throw new Error('All alternative transcript methods failed');
  }

  async getWhisperTranscript(videoId) {
    try {
      // Get video metadata to check duration
      const metadata = await this.getVideoMetadata(videoId);
      const durationMinutes = this.parseDurationToMinutes(metadata.duration);
      
      if (durationMinutes > config.transcript.maxAudioDurationMinutes) {
        throw new Error(`Video too long for Whisper: ${durationMinutes} min > ${config.transcript.maxAudioDurationMinutes} min limit`);
      }

      logger.info(`Video duration: ${durationMinutes} minutes - proceeding with Whisper`);
      
      // Extract audio using ytdl-core and ffmpeg
      const audioPath = await this.extractAudioForWhisper(videoId);
      
      // Use OpenAI Whisper API
      const transcript = await this.transcribeWithWhisper(audioPath);
      
      // Clean up audio file
      this.cleanupTempFile(audioPath);
      
      // Convert Whisper response to our format
      return this.formatWhisperTranscript(transcript);
    } catch (error) {
      logger.error('Whisper transcript failed:', error);
      throw error;
    }
  }

  async extractAudioForWhisper(videoId) {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const audioPath = path.join(tempDir, `${videoId}_audio.mp3`);
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      logger.info(`Extracting audio to: ${audioPath}`);
      
      // Use ytdl-core to get audio stream and convert to mp3 with ffmpeg
      const ytdlStream = ytdl(videoUrl, {
        quality: 'lowestaudio',
        filter: 'audioonly'
      });
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-acodec', 'libmp3lame',
        '-ar', '16000', // 16kHz sample rate for Whisper
        '-ac', '1',     // Mono
        '-b:a', '64k',  // Low bitrate
        '-f', 'mp3',
        audioPath,
        '-y' // Overwrite output file
      ]);
      
      ytdlStream.pipe(ffmpeg.stdin);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          logger.info('Audio extraction completed successfully');
          resolve(audioPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        logger.error('FFmpeg error:', error);
        reject(error);
      });
      
      ffmpeg.stderr.on('data', (data) => {
        logger.debug('FFmpeg stderr:', data.toString());
      });
    });
  }

  async transcribeWithWhisper(audioPath) {
    try {
      // Import OpenAI dynamically to avoid circular dependencies
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: config.openai.apiKey
      });
      
      logger.info(`Transcribing audio file: ${audioPath}`);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });
      
      logger.info('Whisper transcription completed');
      return transcription;
    } catch (error) {
      logger.error('Whisper API call failed:', error);
      throw error;
    }
  }

  formatWhisperTranscript(whisperResponse) {
    if (!whisperResponse || !whisperResponse.segments) {
      // Fallback to simple text if segments not available
      const text = whisperResponse.text || '';
      if (text) {
        return [{
          text: text,
          start: 0,
          duration: 1000
        }];
      }
      return null;
    }
    
    return whisperResponse.segments.map(segment => ({
      text: segment.text?.trim() || '',
      start: Math.round((segment.start || 0) * 1000), // Convert to milliseconds
      duration: Math.round(((segment.end || segment.start || 1) - (segment.start || 0)) * 1000)
    }));
  }

  async getDescriptionAsTranscript(videoId) {
    try {
      const metadata = await this.getVideoMetadata(videoId);
      const description = metadata.description;
      
      if (!description || description.length < 50) {
        throw new Error('Description too short or empty');
      }
      
      // Split description into meaningful segments
      const segments = this.parseDescriptionIntoSegments(description);
      
      if (segments.length === 0) {
        throw new Error('No meaningful content found in description');
      }
      
      logger.info(`Created ${segments.length} transcript segments from description`);
      return segments;
    } catch (error) {
      logger.error('Description fallback failed:', error);
      throw error;
    }
  }

  parseDescriptionIntoSegments(description) {
    // Clean description - remove URLs, timestamps, and excessive whitespace
    const cleanDescription = description
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '') // Remove timestamps
      .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
      .replace(/^[\s\n]+|[\s\n]+$/g, '') // Trim
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join(' ');
    
    if (cleanDescription.length < 50) {
      return [];
    }
    
    // Split into sentences or meaningful chunks
    const sentences = cleanDescription
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Only meaningful sentences
    
    const segments = [];
    let currentTime = 0;
    const segmentDuration = 3000; // 3 seconds per segment
    
    sentences.forEach((sentence, _index) => {
      if (sentence) {
        segments.push({
          text: sentence,
          start: currentTime,
          duration: segmentDuration
        });
        currentTime += segmentDuration;
      }
    });
    
    return segments;
  }

  async getCommentsAsTranscript(videoId) {
    try {
      logger.info(`Attempting to get comments for video: ${videoId}`);
      
      // Get comments using YouTube API
      const response = await this.youtube.commentThreads.list({
        part: 'snippet',
        videoId: videoId,
        maxResults: 50,
        order: 'relevance'
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('No comments found');
      }
      
      // Extract meaningful comments
      const meaningfulComments = response.data.items
        .map(item => item.snippet.topLevelComment.snippet.textDisplay)
        .filter(comment => comment.length > 30 && comment.length < 200)
        .filter(comment => !this.isSpamComment(comment))
        .slice(0, 20); // Limit to 20 comments
      
      if (meaningfulComments.length === 0) {
        throw new Error('No meaningful comments found');
      }
      
      // Convert comments to transcript format
      const segments = [];
      let currentTime = 0;
      const segmentDuration = 4000; // 4 seconds per comment
      
      meaningfulComments.forEach(comment => {
        segments.push({
          text: `Comment: ${comment}`,
          start: currentTime,
          duration: segmentDuration
        });
        currentTime += segmentDuration;
      });
      
      logger.info(`Created transcript from ${segments.length} meaningful comments`);
      return segments;
    } catch (error) {
      logger.error('Comments analysis failed:', error);
      throw error;
    }
  }

  isSpamComment(comment) {
    const spamIndicators = [
      /first|second|third/i,
      /like.*subscribe/i,
      /check.*channel/i,
      /^[^a-zA-Z]*$/,  // Only emojis/special chars
      /^.{1,5}$/,       // Too short
      /@everyone|@here/i
    ];
    
    return spamIndicators.some(pattern => pattern.test(comment));
  }

  parseDurationToMinutes(duration) {
    if (!duration || duration === 'Unknown') return 0;
    
    const parts = duration.split(':').map(p => parseInt(p));
    if (parts.length === 2) {
      return parts[0] + (parts[1] / 60);
    } else if (parts.length === 3) {
      return (parts[0] * 60) + parts[1] + (parts[2] / 60);
    }
    return 0;
  }

  cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
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
      const testVideoId = 'r4IQopBxzOo'; // Rick Roll - always available
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
      logger.info(`Video: ${videoUrl}`);
      const videoId = this.extractVideoId(videoUrl);
      
      // Get metadata and thumbnail in parallel (these should always work)
      const [metadata, thumbnailUrl] = await Promise.all([
        this.getVideoMetadata(videoUrl),
        this.downloadThumbnail(videoUrl)
      ]);
      
      // Get transcript with comprehensive fallbacks
      logger.info(`Attempting transcript extraction for: ${metadata.title}`);
      const transcript = await this.getTranscript(videoUrl);
      
      const transcriptText = this.formatTranscript(transcript);
      
      // Log transcript status
      if (transcript && transcript.length > 0) {
        logger.info(`✅ Successfully extracted transcript: ${transcript.length} segments, ${transcriptText.length} characters`);
      } else {
        logger.warn(`⚠️ No transcript available for video: ${videoId} - "${metadata.title}"`);
      }
      
      return {
        ...metadata,
        transcript,
        transcriptText,
        transcriptStatus: this.getTranscriptStatus(transcript, transcriptText),
        thumbnailUrl,
        originalUrl: videoUrl
      };
    } catch (error) {
      logger.error('Error getting complete video data:', error);
      throw error;
    }
  }
  
  getTranscriptStatus(transcript, transcriptText) {
    if (!transcript || transcript.length === 0) {
      return {
        available: false,
        source: 'none',
        length: 0,
        quality: 'none'
      };
    }
    
    let source = 'unknown';
    let quality = 'medium';
    
    // Determine source based on transcript characteristics
    if (transcript.some(t => t.text && t.text.startsWith('Comment:'))) {
      source = 'comments';
      quality = 'low';
    } else if (transcript.length === 1) {
      source = 'description';
      quality = 'low';
    } else if (transcript.every(t => t.duration && t.duration > 2000)) {
      source = 'whisper';
      quality = 'high';
    } else {
      source = 'youtube';
      quality = 'high';
    }
    
    return {
      available: true,
      source,
      length: transcriptText.length,
      segments: transcript.length,
      quality
    };
  }
}

export default YouTubeService;