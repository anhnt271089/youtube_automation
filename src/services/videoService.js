import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/config.js';
import GoogleDriveService from './googleDriveService.js';
import logger from '../utils/logger.js';

ffmpeg.setFfmpegPath(ffmpegPath);

class VideoService {
  constructor() {
    this.tempDir = './temp';
    this.outputDir = './output';
    this.googleDrive = new GoogleDriveService();
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.tempDir, this.outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async downloadImage(imageUrl, filename) {
    try {
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
      });

      const filepath = path.join(this.tempDir, filename);
      const writer = fs.createWriteStream(filepath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filepath));
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error('Error downloading image:', error);
      throw error;
    }
  }

  async generateImagesFromPrompts(imagePrompts, aiService, videoInfo = null) {
    try {
      const imageUrls = [];
      const localImagePaths = [];
      const driveUrls = [];
      
      // Get image generation limit from config, default to all images
      const imageLimit = parseInt(config.app?.imageGenerationLimit) || imagePrompts.length;
      const promptsToProcess = imagePrompts.slice(0, imageLimit);
      
      logger.info(`Generating ${promptsToProcess.length}/${imagePrompts.length} images`);

      // Create Google Drive folder for this video if videoInfo provided
      let driveImagesFolderId = null;
      if (videoInfo) {
        try {
          const driveFolder = await this.googleDrive.createVideoFolder(videoInfo.title, videoInfo.youtubeVideoId || videoInfo.id);
          const subfolders = await this.googleDrive.createSubfolders(driveFolder.folderId);
          driveImagesFolderId = subfolders['Generated Images'];
          logger.info(`Drive folder: ${driveFolder.folderName}`);
        } catch (error) {
          logger.warn('Drive folder failed:', error.message);
        }
      }

      for (let i = 0; i < promptsToProcess.length; i++) {
        try {
          logger.info(`Image ${i + 1}/${promptsToProcess.length}`);
          
          const imageResult = await aiService.generateImage(promptsToProcess[i]);
          const filename = `image_${i + 1}.png`;
          const localPath = await this.downloadImage(imageResult.url, filename);
          
          imageUrls.push(imageResult.url);
          localImagePaths.push(localPath);
          
          // Upload to Google Drive if folder is available
          if (driveImagesFolderId && fs.existsSync(localPath)) {
            try {
              const driveFile = await this.googleDrive.uploadFile(localPath, filename, driveImagesFolderId, 'image/png');
              driveUrls.push(driveFile.webViewLink || driveFile.webContentLink);
              logger.info(`Uploaded: ${filename}`);
            } catch (driveError) {
              logger.warn(`Upload failed: ${filename}:`, driveError.message);
              driveUrls.push(null);
            }
          } else {
            driveUrls.push(null);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`Image ${i + 1} failed:`, error);
          imageUrls.push(null);
          localImagePaths.push(null);
          driveUrls.push(null);
        }
      }

      return { imageUrls, localImagePaths, driveUrls };
    } catch (error) {
      logger.error('Error in batch image generation:', error);
      throw error;
    }
  }

  async createVideoFromImages(imagePaths, scriptSentences, outputFilename, duration = 180) {
    try {
      const validImages = imagePaths.filter(path => path && fs.existsSync(path));
      
      if (validImages.length === 0) {
        throw new Error('No valid images found for video creation');
      }

      const imageDuration = duration / validImages.length;
      const outputPath = path.join(this.outputDir, outputFilename);

      return new Promise((resolve, reject) => {
        let ffmpegCommand = ffmpeg();

        validImages.forEach((imagePath, _index) => {
          ffmpegCommand = ffmpegCommand.input(imagePath);
        });

        const filterComplex = validImages.map((_, index) => {
          return `[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,trim=duration=${imageDuration}[img${index}]`;
        }).join(';');

        const concatInputs = validImages.map((_, index) => `[img${index}]`).join('');
        const fullFilter = `${filterComplex};${concatInputs}concat=n=${validImages.length}:v=1:a=0[outv]`;

        ffmpegCommand
          .complexFilter(fullFilter)
          .outputOptions([
            '-map', '[outv]',
            '-c:v', 'libx264',
            '-r', '30',
            '-pix_fmt', 'yuv420p'
          ])
          .output(outputPath)
          .on('start', () => {
            logger.info('FFmpeg started');
          })
          .on('progress', (progress) => {
            logger.info(`Video creation progress: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', () => {
            logger.info(`Video created successfully: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (error) => {
            logger.error('FFmpeg error:', error);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error('Error creating video from images:', error);
      throw error;
    }
  }

  async addTextOverlays(videoPath, scriptSentences, outputPath) {
    try {
      return new Promise((resolve, reject) => {
        const videoDuration = 180;
        const textDuration = videoDuration / scriptSentences.length;
        
        const drawTextFilters = scriptSentences.map((sentence, index) => {
          const startTime = index * textDuration;
          const endTime = (index + 1) * textDuration;
          const cleanText = sentence.replace(/'/g, '\\\'').replace(/"/g, '\\"');
          
          return `drawtext=text='${cleanText}':fontfile=/System/Library/Fonts/Arial.ttf:fontsize=48:fontcolor=white:x=(w-tw)/2:y=h-100:enable='between(t,${startTime},${endTime})'`;
        }).join(',');

        ffmpeg(videoPath)
          .outputOptions([
            '-vf', drawTextFilters,
            '-c:v', 'libx264',
            '-c:a', 'copy'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            logger.info('Adding text overlays:', commandLine);
          })
          .on('progress', (progress) => {
            logger.info(`Text overlay progress: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', () => {
            logger.info('Text overlays added successfully');
            resolve(outputPath);
          })
          .on('error', (error) => {
            logger.error('Error adding text overlays:', error);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error('Error in addTextOverlays:', error);
      throw error;
    }
  }

  async createThumbnailFromVideo(videoPath, outputPath, timeOffset = '00:00:01') {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(timeOffset)
          .outputOptions([
            '-vframes', '1',
            '-q:v', '2'
          ])
          .output(outputPath)
          .on('end', () => {
            logger.info('Thumbnail extracted from video');
            resolve(outputPath);
          })
          .on('error', (error) => {
            logger.error('Error creating thumbnail from video:', error);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error('Error in createThumbnailFromVideo:', error);
      throw error;
    }
  }

  async compressVideo(inputPath, outputPath, _targetSizeMB = 50) {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-c:v', 'libx264',
            '-crf', '28',
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            logger.info('Compressing video:', commandLine);
          })
          .on('progress', (progress) => {
            logger.info(`Compression progress: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', () => {
            logger.info('Video compressed successfully');
            resolve(outputPath);
          })
          .on('error', (error) => {
            logger.error('Error compressing video:', error);
            reject(error);
          })
          .run();
      });
    } catch (error) {
      logger.error('Error in compressVideo:', error);
      throw error;
    }
  }

  async createCompleteVideo(videoData, enhancedContent, aiService, existingImagePaths = null) {
    try {
      const videoId = videoData.videoId;
      const timestamp = Date.now();
      
      logger.info(`Creating video: ${videoData.title}`);

      // Use existing image paths if provided, otherwise generate new ones
      let imageUrls, localImagePaths;
      if (existingImagePaths) {
        localImagePaths = existingImagePaths;
        imageUrls = [];
        logger.info('Using existing image paths for video creation');
      } else {
        const result = await this.generateImagesFromPrompts(
          enhancedContent.imagePrompts, 
          aiService
        );
        imageUrls = result.imageUrls;
        localImagePaths = result.localImagePaths;
      }

      const baseVideoFilename = `${videoId}_base_${timestamp}.mp4`;
      const baseVideoPath = await this.createVideoFromImages(
        localImagePaths,
        enhancedContent.scriptSentences,
        baseVideoFilename
      );

      const finalVideoFilename = `${videoId}_final_${timestamp}.mp4`;
      const finalVideoPath = path.join(this.outputDir, finalVideoFilename);
      
      const videoWithText = await this.addTextOverlays(
        baseVideoPath,
        enhancedContent.scriptSentences,
        finalVideoPath
      );

      const compressedFilename = `${videoId}_compressed_${timestamp}.mp4`;
      const compressedPath = path.join(this.outputDir, compressedFilename);
      
      const finalCompressedVideo = await this.compressVideo(
        videoWithText,
        compressedPath
      );

      const thumbnailPath = path.join(this.outputDir, `${videoId}_thumbnail_${timestamp}.jpg`);
      await this.createThumbnailFromVideo(finalCompressedVideo, thumbnailPath);

      this.cleanupTempFiles(localImagePaths, [baseVideoPath, finalVideoPath]);

      logger.info('Complete video creation finished successfully');
      
      return {
        videoPath: finalCompressedVideo,
        thumbnailPath,
        imageUrls,
        duration: 180,
        filename: compressedFilename
      };
    } catch (error) {
      logger.error('Error in createCompleteVideo:', error);
      throw error;
    }
  }

  cleanupTempFiles(imagePaths, videoPaths = []) {
    try {
      [...imagePaths, ...videoPaths].forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up temp file: ${filePath}`);
        }
      });
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }

  getVideoStats(videoPath) {
    try {
      const stats = fs.statSync(videoPath);
      return {
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        created: stats.birthtime
      };
    } catch (error) {
      logger.error('Error getting video stats:', error);
      return null;
    }
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default VideoService;