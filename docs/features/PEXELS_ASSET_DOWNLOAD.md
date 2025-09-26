# Pexels Asset Download & Google Drive Upload Feature

## Overview

This feature provides comprehensive Pexels asset download and Google Drive upload functionality for the YouTube automation system. It automatically processes Script Breakdown sheets, downloads appropriate assets (videos or photos) based on sentence word count, and uploads them to Google Drive with shareable links.

## 🎯 Key Features

- **Smart Asset Selection**: Automatically chooses video assets for sentences with >6 words, photo assets for ≤6 words
- **Search Integration**: Uses search phrases from Script Breakdown sheet for relevant asset discovery
- **Random Selection**: Randomly selects 1 asset from top 10 search results for variety
- **File Naming**: Consistent naming with S-{sentenceNumber} prefix (e.g., S-1.mp4, S-2.jpg)
- **Google Drive Integration**: Uploads to video's dedicated Drive folder with shareable links
- **Sheet Updates**: Updates Image URL column in Script Breakdown with uploaded asset URLs
- **Production-Ready**: Comprehensive error handling, logging, retry mechanisms, and cleanup

## 🏗️ Architecture

### Components

1. **PexelsService** (`/src/services/pexelsService.js`)
   - Core service handling Pexels API interactions
   - Asset download and Google Drive upload coordination
   - Integration with existing GoogleSheetsService and GoogleDriveService

2. **Configuration** (`/config/config.js`)
   - Pexels API configuration and settings
   - Timeout, retry, and performance tuning parameters

3. **Test Tool** (`/tools/download-pexels-assets.js`)
   - Comprehensive testing and demonstration tool
   - Health checks, video listing, and asset processing

### Integration Points

- **GoogleSheetsService**: Reads Script Breakdown data, updates Image URL column
- **GoogleDriveService**: Handles file uploads and shareable link generation
- **Existing Folder Structure**: Uses video's dedicated Google Drive folder

## 🔧 Setup & Configuration

### 1. Environment Variables

Add to your `.env` file:

```bash
# Pexels API (get your free API key from https://www.pexels.com/api/)
PEXELS_API_KEY=your_pexels_api_key
```

### 2. Get Pexels API Key

1. Visit [https://www.pexels.com/api/](https://www.pexels.com/api/)
2. Create a free account
3. Apply for API access (usually approved instantly)
4. Copy your API key to the `.env` file

### 3. Verify Configuration

```bash
npm run test-pexels
# or
node tools/download-pexels-assets.js --health-check
```

## 📋 Prerequisites

### Required Setup
- ✅ Google Sheets integration configured
- ✅ Google Drive integration configured
- ✅ Video must exist in master sheet
- ✅ Video must have Script Breakdown sheet with search phrases
- ✅ PEXELS_API_KEY environment variable set

### Script Breakdown Requirements
The Script Breakdown sheet must contain:
- **Search phrase** column (Column D) - populated with relevant search terms
- **Word Count** column (Column H) - used for asset type selection
- **Image URL** column (Column E) - will be updated with downloaded asset URLs

## 🚀 Usage

### Command Line Interface

```bash
# Process specific video
npm run download-pexels-assets VID-0001
node tools/download-pexels-assets.js VID-0001

# List all available videos with processing status
npm run download-pexels-assets -- --list-videos
node tools/download-pexels-assets.js --list-videos

# Health check - test API connectivity
npm run test-pexels
node tools/download-pexels-assets.js --health-check

# Show help
node tools/download-pexels-assets.js --help
```

### Programmatic Usage

```javascript
import PexelsService from './src/services/pexelsService.js';

const pexelsService = new PexelsService();

// Process all assets for a video
const results = await pexelsService.processScriptBreakdownAssets('VID-0001');

// Search for specific assets
const photos = await pexelsService.searchPhotos('business person', 10);
const videos = await pexelsService.searchVideos('office meeting', 10);

// Get processing statistics
const stats = await pexelsService.getProcessingStats('VID-0001');
```

## 🎬 Asset Selection Logic

### Word Count Based Selection

| Sentence Word Count | Asset Type | File Extension | Example Filename |
|-------------------|------------|---------------|------------------|
| ≤ 6 words | Photo | .jpg | S-1.jpg |
| > 6 words | Video | .mp4 | S-5.mp4 |

### Search Process

1. **Search Phrase Extraction**: Uses search phrase from Script Breakdown (Column D)
2. **Asset Search**: Queries Pexels API for top 10 relevant results
3. **Random Selection**: Randomly selects 1 asset from results for variety
4. **Quality Selection**: Chooses best available quality (Original/HD for photos, HD/SD for videos)

### File Naming Convention

- **Format**: `S-{sentenceNumber}{extension}`
- **Examples**: `S-1.jpg`, `S-3.mp4`, `S-12.jpg`
- **Consistency**: Maintains clear mapping between sentences and assets

## 📊 Processing Flow

```
1. Validate Video & Configuration
   ├── Check video exists in master sheet
   ├── Verify Drive folder accessibility
   └── Validate Script Breakdown data

2. For Each Sentence:
   ├── Determine Asset Type (word count > 6 ? video : photo)
   ├── Search Pexels API (top 10 results)
   ├── Randomly Select Asset
   ├── Download to Temporary Location
   ├── Upload to Google Drive
   ├── Generate Shareable Link
   ├── Update Script Breakdown Sheet
   └── Cleanup Temporary Files

3. Generate Processing Summary
   ├── Success/Failure Counts
   ├── Asset Type Distribution
   └── Error Details
```

## 🛡️ Error Handling & Resilience

### Retry Mechanisms
- **API Calls**: 3 retries with exponential backoff
- **Downloads**: Network timeout protection with retries
- **Upload Operations**: Google Drive API retry logic

### Error Recovery
- **Temporary File Cleanup**: Automatic cleanup on success/failure
- **Status Tracking**: Updates sheet status for failed operations
- **Partial Success**: Continues processing remaining sentences if individual failures occur

### Validation & Safety
- **Input Validation**: Video ID format, API key presence
- **Rate Limiting**: 1-second delays between API requests
- **Resource Management**: Automatic temporary file cleanup

## 📈 Performance & Monitoring

### Processing Statistics

```javascript
const stats = await pexelsService.getProcessingStats('VID-0001');
// Returns:
{
  videoId: 'VID-0001',
  totalSentences: 25,
  processed: 20,
  pending: 3,
  failed: 2
}
```

### Logging & Monitoring

The service provides comprehensive logging:
- **Info Level**: Processing progress, success confirmations
- **Warn Level**: Non-critical issues, fallback usage
- **Error Level**: Critical failures with detailed context

### Performance Considerations

- **API Rate Limits**: Respects Pexels API limits (200 requests/hour for free tier)
- **Network Optimization**: Efficient download with timeout protection
- **Memory Management**: Streams file data, minimal memory footprint
- **Concurrent Processing**: Sequential processing to respect API limits

## 🔍 Troubleshooting

### Common Issues

#### "PEXELS_API_KEY is required"
**Solution**: Add `PEXELS_API_KEY=your_api_key` to `.env` file

#### "No Script Breakdown found"
**Solution**: Ensure video has been processed and Script Breakdown sheet exists with search phrases

#### "No search phrase for sentence X"
**Solution**: Populate search phrases in Script Breakdown Column D

#### "Drive folder not found"
**Solution**: Ensure video has associated Google Drive folder in master sheet

### Debug Mode

Enable detailed logging by setting `LOG_LEVEL=debug` in `.env`:

```bash
LOG_LEVEL=debug node tools/download-pexels-assets.js VID-0001
```

### Health Check

Run comprehensive health checks:

```bash
node tools/download-pexels-assets.js --health-check
```

This verifies:
- ✅ Pexels API connectivity
- ✅ Google Sheets integration
- ✅ Google Drive access
- ✅ Configuration validity

## 🎯 Integration Examples

### Workflow Integration

```javascript
// Example: Complete video processing workflow
import PexelsService from './src/services/pexelsService.js';
import GoogleSheetsService from './src/services/googleSheetsService.js';

const pexelsService = new PexelsService();
const sheetsService = new GoogleSheetsService();

// 1. Get videos ready for asset processing
const approvedVideos = await sheetsService.getVideosWithApprovedScripts();

// 2. Process assets for each video
for (const video of approvedVideos) {
  console.log(`Processing assets for ${video.videoId}`);

  const results = await pexelsService.processScriptBreakdownAssets(video.videoId);

  if (results.successCount > 0) {
    console.log(`✅ Downloaded ${results.successCount} assets for ${video.videoId}`);
  }

  if (results.failureCount > 0) {
    console.log(`⚠️ ${results.failureCount} failures for ${video.videoId}`);
  }
}
```

### Custom Asset Processing

```javascript
// Example: Process specific sentences only
import PexelsService from './src/services/pexelsService.js';

const pexelsService = new PexelsService();

// Get specific sentence data
const sentence = {
  sentenceNumber: 5,
  searchPhrase: 'business meeting office',
  wordCount: 8  // Will download video
};

// Process single sentence
const result = await pexelsService.processSentenceAsset('VID-0001', sentence, folderId);

if (result.success) {
  console.log(`Downloaded: ${result.filename} (${result.assetType})`);
  console.log(`Drive URL: ${result.driveUrl}`);
}
```

## 🔮 Future Enhancements

### Planned Features
- **Batch Processing**: Process multiple videos simultaneously
- **Asset Quality Options**: User-configurable quality preferences
- **Search Term Enhancement**: AI-powered search phrase optimization
- **Asset Filtering**: Content type, duration, and style filters
- **Cost Management**: Usage tracking and budget controls

### Integration Opportunities
- **Telegram Notifications**: Asset processing completion alerts
- **Webhook Support**: External system integration
- **Analytics Dashboard**: Processing metrics and insights

## 📝 API Reference

### PexelsService Methods

#### `searchPhotos(query, perPage=10)`
Search for photo assets on Pexels.

**Parameters:**
- `query` (string): Search query
- `perPage` (number): Results per page (default: 10)

**Returns:** `Promise<Array>` - Array of photo objects

#### `searchVideos(query, perPage=10)`
Search for video assets on Pexels.

**Parameters:**
- `query` (string): Search query
- `perPage` (number): Results per page (default: 10)

**Returns:** `Promise<Array>` - Array of video objects

#### `processScriptBreakdownAssets(videoId)`
Main processing method - downloads assets for all sentences in Script Breakdown.

**Parameters:**
- `videoId` (string): Video ID (e.g., 'VID-0001')

**Returns:** `Promise<Object>` - Processing results summary

#### `getProcessingStats(videoId)`
Get processing statistics for a video.

**Parameters:**
- `videoId` (string): Video ID

**Returns:** `Promise<Object>` - Statistics object

#### `healthCheck()`
Verify Pexels API connectivity and service health.

**Returns:** `Promise<Object>` - Health status

## 💡 Best Practices

### Search Phrase Optimization
- Use specific, visual terms
- Include context (business, lifestyle, technology)
- Avoid overly abstract concepts
- Consider target audience and brand

### Processing Strategy
- Process videos during off-peak hours
- Monitor API usage limits
- Review failed downloads and adjust search phrases
- Use batch processing for multiple videos

### Quality Assurance
- Review downloaded assets before final video production
- Maintain consistent visual style across videos
- Consider asset licensing requirements
- Test with different search phrases for optimal results

---

## 📞 Support

For issues, questions, or feature requests related to Pexels asset download:

1. **Health Check**: Run `npm run test-pexels` for diagnostics
2. **Documentation**: Review this guide and inline code comments
3. **Logs**: Check application logs for detailed error information
4. **Configuration**: Verify all environment variables are set correctly

---

*This feature is part of the YouTube Automation System's comprehensive asset management capabilities, designed to streamline video production workflows with automated, high-quality asset sourcing.*