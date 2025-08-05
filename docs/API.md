# API Documentation

## Service APIs

### WorkflowService
Main orchestrator service that coordinates all other services.

#### Methods
- `processNewVideos()` - Process videos with 'New' status
- `processApprovedScripts()` - Process approved scripts for video generation
- `processUrl(url)` - Process a single YouTube URL
- `getSystemStatus()` - Get overall system health status

### YouTubeService
Handles YouTube API interactions.

#### Methods
- `getVideoMetadata(videoId)` - Extract video metadata
- `getTranscript(videoId)` - Get video transcript
- `downloadThumbnail(videoId, outputPath)` - Download video thumbnail

### NotionService
Manages Notion database operations.

#### Methods
- `getVideos(status)` - Get videos by status
- `updateVideo(videoId, updates)` - Update video record
- `addVideoUrl(url)` - Add new YouTube URL to database
- `getNextVideoId()` - Generate sequential VideoID

### AIService
Handles AI content generation using OpenAI and Anthropic.

#### Methods
- `generateAttractiveScript(transcript, metadata)` - Generate optimized script
- `generateOptimizedDescription(script, metadata)` - Create SEO description
- `generateKeywords(script, metadata)` - Extract SEO keywords
- `generateImage(prompt)` - Create DALL-E image

### GoogleDriveService
Manages Google Drive and Sheets operations.

#### Methods
- `createVideoFolder(videoTitle, videoId)` - Create organized folder
- `uploadFile(filePath, fileName, folderId)` - Upload file to Drive
- `createScriptBreakdown(script, videoId)` - Create Google Sheets breakdown

### TelegramService
Handles notifications and approvals.

#### Methods
- `sendMessage(message)` - Send notification
- `sendApprovalRequest(videoData)` - Request script approval
- `sendError(error, context)` - Send error notification

### VideoService
Processes video creation with FFmpeg.

#### Methods
- `createVideo(scriptSegments, images, outputPath)` - Assemble final video
- `addTextOverlay(imagePath, text, outputPath)` - Add text to image
- `generateThumbnail(imagePath, title)` - Create custom thumbnail