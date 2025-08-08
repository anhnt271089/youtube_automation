# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Important
- Always use use a specialized subagent to do every single task
- Task need pass QA. QC before mark done
- Update all related document if needed when requirement change 
- When finish task, find issue from Google Sheets Issue List and fix them then change status of that issue in the Google Sheets

## 🔄 Migration Status: Google Sheets + Google Drive Integration

**COMPLETED**: Full migration from Notion + Digital Ocean to Google Sheets + Google Drive

**Key Changes:**
- ✅ **Database Layer**: Migrated from Notion databases to Google Sheets with hierarchical structure
- ✅ **File Storage**: Migrated from Digital Ocean Spaces to Google Drive with shareable links
- ✅ **Service Integration**: Replaced NotionService with GoogleSheetsService
- ✅ **Authentication**: Google Service Account with Sheets + Drive API access
- ✅ **Data Structure**: Master Sheet → Video Info Sheet → Script Details Sheet hierarchy
- ✅ **Asset Management**: Images stored in Google Drive with automatic sharing and URL generation

**Benefits:**
- **Cost Reduction**: Eliminated Digital Ocean storage costs
- **Simplified Setup**: Single Google account for both database and storage
- **Better Integration**: Native Google ecosystem with consistent permissions
- **Enhanced Collaboration**: Direct Google Sheets access for manual workflow management
- **Improved Reliability**: Google's infrastructure and API stability



<!-- # Code Development Team

Execute coding project tasks using a structured development team approach with proper requirements analysis, development, testing, and quality assurance.

## System Prompt
You are the Tech Lead coordinating a software development team. Execute the given coding task using specialized developers with proper requirements analysis, parallel execution, testing, and quality validation.

### Team Structure:
- **Tech Lead/Solution Architect**: Break down coding tasks and coordinate team
- **Business Analyst**: Ensure requirements clarity across all developers  
- **Specialized Developers**: Execute coding tasks using best-fit subagents
- **QA/QC**: Unit test and validate all code deliverables

### Development Workflow:
```
Solution → Task Breakdown → Coding → Unit Testing → QA/QC
    ↑         ↑                                      ↓
    └─────────└─── If error, return to Tech Lead ────┘
                                                      ↓
                                            Check with whole system
                                                      ↓
                                            If error → return to Tech Lead
                                                      ↓
                                            If pass → /git-emoji commit
```

### Development Process:

1. **Requirements Analysis**
   - Business Analyst communicates with all developers
   - Ensure each developer understands correct coding requirements
   - Clarify technical specifications and dependencies

2. **Task Breakdown & Architecture**
   - Tech Lead/Solution Architect breaks down coding tasks
   - Identify code dependencies and parallel development opportunities
   - Assign best-fit specialized agents for each coding component

3. **Parallel Development**
   - Execute non-conflicting coding tasks concurrently using Task tool
   - Use best-fit specialized subagents based on task requirements
   - Select agents that match the specific coding domain and complexity

4. **Unit Testing**
   - All code must include unit tests
   - Test each code component individually
   - Validate functionality meets requirements

5. **QA/QC Validation**
   - Use qa-solution-validator for comprehensive code validation
   - If errors found → return to Tech Lead for reassignment
   - If no errors → proceed to system integration

6. **System Integration Testing**
   - Test complete code solution with entire system
   - Verify no breaking changes to existing codebase
   - If errors found → return to Tech Lead for fixes
   - If all tests pass → use /git-emoji to commit changes

7. **Error Resolution Loop**
   - Any errors at QA/QC or system level return to Tech Lead
   - Tech Lead reassigns to development team for fixes
   - Re-validate after fixes until zero bugs/issues

### Execution Protocol:
1. Create TodoWrite for coding task tracking
2. BA ensures coding requirement clarity
3. Tech Lead breaks down and assigns coding tasks
4. Launch parallel development using best-fit subagents
5. Run unit tests on all code
6. QA validates each code deliverable
7. If errors → return to Tech Lead for fixes
8. If no errors → test with whole system
9. If system errors → return to Tech Lead
10. If system passes → use /git-emoji to commit
11. **IMPORTANT**: Update README.md to document any changes made to the codebase
12. Complete only when committed successfully

Focus on quality code, proper testing, and maintaining codebase stability throughout the development process. -->

## Project Overview

This is a comprehensive YouTube content automation system built with Node.js that transforms YouTube videos into optimized short-form content using AI. The system orchestrates a complete workflow from URL processing to final video delivery through Google Sheets, Google Drive, and Telegram integrations.

## Development Commands

### Essential Commands
```bash
npm start              # Start production system with cron scheduling
npm run dev            # Development mode with nodemon auto-restart
npm run lint           # ESLint code checking - MUST pass before commits
npm run typecheck      # TypeScript validation - MUST pass before commits
npm test               # Run Jest test suite - MUST pass before commits
```

### 🔧 Recent Workflow Fixes (Latest Update)

**Critical Issues Fixed:**
- ✅ **Master Sheet Population**: Optimized content (title, description, keywords) now only goes to Video Detail sheets, not master sheet
- ✅ **Status Progression**: Workflow correctly moves from "Script Separated" → "Completed" when image generation is disabled
- ✅ **Video Info Sheet**: Now properly populated with complete metadata, optimized content, and full script sections
- ✅ **Script Text Truncation**: Full sentence text preserved in script breakdowns (no more cut-off text)
- ✅ **Image Prompts**: Generated when script breakdown enabled, even if image generation is disabled
- ✅ **Analytics Tab**: Now populated with processing metrics and video analytics
- ✅ **Full Script Sections**: Added comprehensive sections for Video Editor and Voice Generator workflows
- ✅ **Voice Script Enhancement**: `voice_script.txt` now formats each sentence on a separate line for optimal voice generation

**Current Working Configuration:**
```bash
ENABLE_IMAGE_GENERATION=false   # Disabled to save costs
ENABLE_SCRIPT_BREAKDOWN=true    # Enabled for detailed script analysis
AUTO_APPROVE_SCRIPTS=true       # Optional: enables automatic approval for testing
```

### Configuration Toggle Options

The system supports configurable workflow stages through environment variables:

**Image Generation Control (Default: Disabled)**
```bash
ENABLE_IMAGE_GENERATION=false  # Enable/disable image generation completely
ENABLE_SCRIPT_BREAKDOWN=true   # Enable/disable script sentence breakdown  
```

**Cost-Optimized Workflow Options:**
- `ENABLE_IMAGE_GENERATION=false`: Skips DALL-E image generation entirely, saves ~$0.40-0.80 per video
- `ENABLE_SCRIPT_BREAKDOWN=true`: Creates detailed sentence-level script breakdown with image prompts
- **Fixed Workflow**: Now correctly progresses through all statuses regardless of image generation setting

**Current Workflow Behavior:**
- **New** → **Processing** → **Script Separated** → **Completed** (when images disabled)
- **Video Detail Sheets**: Populated with optimized content, full scripts, and processing analytics
- **Script Breakdown**: Individual sentences with image prompts and editor keywords
- **Master Sheet**: Contains only basic tracking data (no optimized content)

### System Operations
```bash
# Test system functionality with unified test script
node test-single-run.js health                    # Health check only
node test-single-run.js all                       # Run all services once
node test-single-run.js single-video <url>        # Process specific video
node test-single-run.js new-videos               # Process new videos
node test-single-run.js approved-scripts         # Process approved scripts
node test-single-run.js ready-for-review         # Process ready for review videos
node test-single-run.js error-videos             # Test error recovery system

# Note: Video generation is handled manually outside the automated flow

# Manual workflow testing
node -e "
import('./src/index.js').then(async (m) => {
  const automation = new m.default();
  await automation.initialize();
  console.log('System initialized successfully');
  await automation.stop();
});"
```

### Development Workflow Commands
```bash
# Before any development work
npm run lint && npm run typecheck && npm test

# After code changes
npm run lint -- --fix    # Auto-fix linting issues
npm run typecheck        # Ensure type safety
npm test                 # Verify functionality

# Production readiness check
npm run lint && npm run typecheck && npm test && node src/index.js --health-check
```

## Architecture Overview

### Service-Oriented Architecture
The system follows a service-oriented pattern with a central WorkflowService orchestrating specialized services:

```
WorkflowService (Central Orchestrator)
├── YouTubeService       # Video metadata/transcript extraction  
├── GoogleSheetsService  # Database operations & approval workflows
├── GoogleDriveService   # Cloud storage for images & assets
├── AIService           # OpenAI/Anthropic content generation + DALL-E 3
├── TelegramService     # Notifications & manual approvals
└── VideoService        # FFmpeg video processing & assembly
```

### Processing Pipeline
1. **Input Stage**: YouTube URLs tracked in Google Sheets with unique VideoID (VID-XX format)
2. **Extraction**: Video metadata, transcripts, thumbnails via YouTube API with 5-layer fallback
3. **AI Enhancement**: Script optimization, descriptions, titles using GPT-4o-mini
4. **Organization**: Hierarchical Google Sheets structure (Master Sheet → Video Info Sheet → Script Details Sheet)
5. **Approval**: Auto-approval or manual review workflow via Telegram notifications
6. **Generation**: AI image creation (DALL-E 3, 16:9 format), consistent styling, thumbnail generation
7. **Storage**: Assets uploaded to Google Drive with shareable links
8. **Completion**: Automated workflow ends - ready for manual voice generation and video assembly
9. **Voice Processing**: Manual voice generation using optimized scripts (Voice Status checkbox tracking)
10. **Final Assembly**: Manual video creation with voice and images (handled outside the system)

### Key Design Patterns

#### Cron-Based Automation
- Multiple scheduled jobs run at different intervals (10-15 minutes)
- Each job processes different workflow stages independently (video generation removed from automation)
- **Enhanced Resume Capability**: Automatically handles interrupted workflows in any processing state
- Graceful shutdown handling with SIGINT/SIGTERM signals

#### Error Handling Strategy
- Comprehensive logging with Winston (logs/ directory)
- Telegram notifications with VideoID format (VID-XX - Video Title)
- Per-video error tracking with retry mechanisms
- **Smart Resume**: Videos stuck in "Processing" or "Generating Images" are automatically resumed
- Status tracking in Google Sheets database
- **Automated Error Recovery**: Complete retry system with exponential backoff
  - **Retry Schedule**: 1h → 2h → 4h → 8h cooldown between attempts
  - **Max Retries**: 3 attempts before permanent skip
  - **Smart Reset**: Videos reset to appropriate processing stage based on error location
  - **Cron Automation**: Automatic retry processing every 2 hours
  - **Manual Override**: Force retry capability for immediate testing
  - **Error Tracking Fields**: 5 dedicated columns in Google Sheets for complete error monitoring:
    - 🤖 Error Message (detailed error description)
    - 🤖 Error Stage (processing stage where error occurred)
    - 🤖 Error Time (timestamp of error occurrence)
    - 🤖 Retry Count (number of retry attempts made)
    - 🤖 Last Retry Time (timestamp of most recent retry)
  - **Telegram Integration**: Retry notifications with attempt count and cooldown info

#### State Management
- Google Sheets serves as primary state store with unique VideoID (VID-XX format)
- **Main Automation Status**: 'New' → 'Processing' → 'Script Separated' → 'Approved' → 'Generating Images' → 'Completed'
- **Voice Generation Status**: Auto-populated workflow tracking for voice generation phase
  - 'Not Ready' → 'Not Started' (auto-triggered when Script Separated)
  - 'Not Started' → 'In Progress' → 'Completed' → 'Need Changes' (manual transitions)
- **Video Editing Status**: Auto-populated workflow tracking for video editing phase
  - 'Not Ready' → 'Not Started' (auto-triggered when Automation = 'Completed' AND Voice = 'Completed')
  - 'Not Started' → 'In Progress' → 'First Draft' → 'Completed' → 'Published' (manual transitions)
- **Legacy Voice Status**: Separate checkbox field for backward compatibility (still supported)
- **Intelligent Recovery**: System detects and resumes interrupted workflows at correct stage
- **Auto-Population Logic**: Status transitions happen automatically without user intervention
- Manual approval gates prevent automated progression (optional auto-approval available)

### Voice Script Enhancement (Latest Feature)

**Enhanced voice_script.txt Format:**
- Each sentence now appears on its own line with double spacing
- Clean, readable format optimized for voice generation workflows
- Professional header with Video ID, title, and generation timestamp

**File Format Example:**
```
=== VOICE SCRIPT ===
Video ID: VID-0001
Video Title: [Video Title]
Generated: [Timestamp]

=== SCRIPT SENTENCES ===
First sentence goes here.

Second sentence goes here.

Third sentence goes here.
```

**Benefits:**
- Voice generators work better with sentence-by-sentence input
- Easy to track progress during voice recording
- Clean format without editing notes or technical instructions
- Automatically uploaded to each video's Google Drive folder

### Workflow Status Auto-Population

The system automatically manages Voice Generation Status and Video Editing Status transitions to provide clear workflow progression indicators without requiring manual status updates.

#### Voice Generation Status Auto-Population
- **Trigger**: When main automation reaches "Script Separated" status
- **Transition**: "Not Ready" → "Not Started"
- **Logic**: Indicates that script is ready for voice generation workflow
- **Manual Control**: Users manually progress through: "Not Started" → "In Progress" → "Completed" → "Need Changes"

#### Video Editing Status Auto-Population  
- **Trigger**: When BOTH conditions are met:
  1. Main automation status = "Completed" (automation workflow finished)
  2. Voice Generation Status = "Completed" (voice generation finished)
- **Transition**: "Not Ready" → "Not Started"
- **Logic**: Ensures video editing only begins after both automation and voice generation are complete
- **Manual Control**: Users manually progress through: "Not Started" → "In Progress" → "First Draft" → "Completed" → "Published"

#### Implementation Details
- Status updates happen seamlessly during normal workflow processing
- No user intervention required for auto-population triggers
- System checks current status before updating to prevent overwriting manual changes
- Logging provides visibility into automatic status transitions
- Backward compatible with existing workflows and legacy Voice Status checkbox

## Configuration Requirements

### Environment Setup
The system requires extensive API integration. Copy `.env.example` to `.env` and configure:

**Workflow Configuration (Cost Control):**
- `ENABLE_IMAGE_GENERATION` (default: false): Toggle AI image generation workflow
- `ENABLE_SCRIPT_BREAKDOWN` (default: false): Toggle sentence-level script breakdown
- `IMAGE_GENERATION_LIMIT` (default: 5): Maximum images per video (0 = no limit)
- `AUTO_APPROVE_SCRIPTS` (default: false): Skip manual approval step for testing

**Google Integration Setup Guide:**
1. **Google Cloud Project Setup:**
   - Create a Google Cloud project at console.cloud.google.com
   - Enable Google Sheets API and Google Drive API
   - Create a service account and download the JSON credentials
   - Extract GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, and GOOGLE_PROJECT_ID from the JSON

2. **Google Sheets Setup:**
   - Create a new Google Sheets document
   - Share the sheet with your service account email (Editor permissions)
   - Copy the sheet ID from the URL and set as GOOGLE_SHEET_ID
   - Create the Master Sheet with the column structure defined in the schema

3. **Google Drive Setup:**
   - Create a folder in Google Drive for image storage
   - Share the folder with your service account email (Editor permissions)
   - Copy the folder ID from the URL and set as GOOGLE_DRIVE_FOLDER_ID
   - Ensure the service account can create and share files in this folder

**Timezone Configuration:**
- `TIMEZONE` (optional): Timezone for cron job scheduling (default: 'Asia/Bangkok' GMT+7)
  - Examples: 'Asia/Bangkok', 'America/New_York', 'Europe/London', 'UTC'
  - All cron jobs will execute according to this timezone

**Critical Services:**
- YouTube Data API v3 (metadata extraction)
- Google Sheets API v4 (database operations with VideoID)
- Google Drive API v3 (file storage and management)
- OpenAI API (GPT-4o-mini + conditional DALL-E 3 image generation)
- Anthropic API (alternative AI provider)
- Telegram Bot (notifications/approvals with enhanced formatting)

**Google Services Configuration:**
- Google Cloud Service Account with Sheets and Drive API access
- Google Sheets: Master Sheet + individual Video Info and Script Detail sheets
- Google Drive: Organized folder structure for image assets and video files
- Proper sharing permissions for automated file access and user visibility

**Required Environment Variables:**
```bash
# Google Service Account Configuration
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PROJECT_ID="your-google-cloud-project-id"

# Google Sheets Configuration
GOOGLE_SHEET_ID="your-master-sheet-id-from-sheets-url"
GOOGLE_SHEET_NAME="Master Sheet"  # Name of the main worksheet tab

# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID="your-drive-folder-id-for-image-storage"

# Other required APIs
YOUTUBE_API_KEY="your-youtube-data-api-key"
OPENAI_API_KEY="your-openai-api-key"
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-or-channel-id"
```

### Google Sheets Database Schema

**Video Identification:**
Videos are identified using a sequential VideoID system in VID-XX format (VID-40, VID-41, etc.) stored in the first column of the Master Sheet. This provides clean identification for Telegram notifications and easy reference across all sheets.

#### Master Sheet Structure

**🔧 INPUT SECTION - Manual Input Required:**
- `A: ID` (Text): Auto-generated VideoID in VID-XX format (VID-40, VID-41...)
- `B: 🔧 YouTube URL` (Text): Source video URL - **ONLY FIELD YOU NEED TO INPUT**
- `C: 🔧 Script Approved` (Text): Manual approval flag for script processing (TRUE/FALSE)

**🤖 AUTOMATION SECTION - Auto-Populated Columns (Read-Only):**
- `D: 🤖 Title` (Text): Video title (extracted from YouTube)
- `E: 🤖 Status` (Text): Main automation workflow state tracking (defaults to 'New')
  - Values: 'New', 'Processing', 'Script Separated', 'Approved', 'Generating Images', 'Completed', 'Error'
- `F: 🤖 Channel` (Text): YouTube channel name (extracted from YouTube)
- `G: 🤖 YouTube Video ID` (Text): YouTube video ID (extracted from URL)
- `H: 🤖 Duration` (Text): Video duration (extracted from YouTube)
- `I: 🤖 View Count` (Number): Video view count (extracted from YouTube)
- `J: 🤖 Published Date` (Date): Video publish date (extracted from YouTube)
- `K: 🤖 Voice Generation Status` (Text): Voice generation workflow tracking (auto-populated)
  - Default: 'Not Ready' → Auto-updates to 'Not Started' when Status = 'Script Separated'
  - Values: 'Not Ready', 'Not Started', 'In Progress', 'Completed', 'Need Changes'
- `L: 🤖 Video Editing Status` (Text): Video editing workflow tracking (auto-populated)
  - Default: 'Not Ready' → Auto-updates to 'Not Started' when Status = 'Completed' AND Voice Generation Status = 'Completed'
  - Values: 'Not Ready', 'Not Started', 'In Progress', 'First Draft', 'Completed', 'Published'
- `M: 🤖 Created Time` (Date): Auto-populated timestamp when row is created
- `N: 🤖 Last Edited Time` (Date): Auto-populated timestamp when row is last modified

**👤 MANUAL WORKFLOW SECTION - User-Controlled Status Fields:**
- `👤 Script Review Status` (Select): Manual script review workflow tracking
  - Options: 'Not Started', 'Reviewing', 'Approved', 'Needs Changes', 'Rejected'
- `👤 Voice Generation Notes` (Text): User notes for voice generation process
- `👤 Video Editing Notes` (Text): User notes for video editing process
- `👤 Final Status` (Select): Manual final status tracking
  - Options: 'Draft', 'Review', 'Approved', 'Published', 'Archived'

**📊 OVERVIEW SECTION - Calculated/Formula Fields:**
- `📊 Processing Progress` (Formula): Automated progress calculation based on status
- `📊 Days Since Created` (Formula): Days since video was added to database
- `📊 Content Quality Score` (Formula): Quality score based on view count and duration
- `📊 Total Processing Time` (Formula): Time from creation to completion

**Legacy Fields (Backward Compatibility):**
- `Voice Status` (Checkbox): Legacy manual flag for voice generation (still supported)

#### Video Info Sheet Structure

The system creates a dedicated "Video Info" sheet for each video containing detailed video information and script content:

**🔧 INPUT SECTION - Manual Input Required:**
- `A: Video ID` (Text): VideoID reference from Master Sheet (VID-XX format)
- `B: 🔧 YouTube URL` (Text): Source video URL (copied from Master Sheet)

**🤖 VIDEO METADATA SECTION - Auto-Populated (Read-Only):**
- `C: 🤖 Title` (Text): Original video title
- `D: 🤖 Channel` (Text): YouTube channel name
- `E: 🤖 Duration` (Text): Video duration
- `F: 🤖 View Count` (Number): Video view count
- `G: 🤖 Published Date` (Date): Video publish date
- `H: 🤖 Description` (Text): Original video description
- `I: 🤖 Transcript` (Text): Full video transcript

**🤖 OPTIMIZED CONTENT SECTION - Auto-Populated (Read-Only):**
- `J: 🤖 Optimized Title` (Text): AI-optimized title for shorts
- `K: 🤖 Optimized Description` (Text): AI-optimized description
- `L: 🤖 Keywords` (Text): Extracted keywords for SEO
- `M: 🤖 Hook` (Text): Engaging opening hook
- `N: 🤖 Call to Action` (Text): Compelling call to action

**🤖 SCRIPT SECTIONS - Auto-Populated (Read-Only):**
- `O: 🤖 Full Script` (Text): Complete optimized script
- `P: 🤖 Script for Voice Generator` (Text): Script formatted for voice generation
- `Q: 🤖 Script for Video Editor` (Text): Script with editing notes and timing
- `R: 🤖 Clean Voice Script` (Text): Pure voice script text without editing suggestions
- `S: 🤖 Voice Script File` (URL): Link to voice_script.txt file in Google Drive

**🤖 ANALYTICS SECTION - Auto-Populated (Read-Only):**
- `T: 🤖 Processing Time` (Text): Total processing duration
- `U: 🤖 Script Length` (Number): Word count of optimized script
- `V: 🤖 Cost Estimate` (Text): Processing cost breakdown
- `W: 🤖 Images Generated` (Number): Count of images created
- `X: 🤖 Drive Folder URL` (URL): Link to Google Drive folder with assets

#### Script Details Sheet Structure

When script breakdown is enabled, the system creates a "Script Details" sheet with sentence-level breakdown:

**🤖 AUTOMATION SECTION - Auto-Populated (Read-Only):**
- `A: 🤖 Sentence Number` (Number): Sequential sentence number
- `B: 🤖 Script Text` (Text): The actual sentence text content
- `C: 🤖 Image Prompt` (Text): AI-generated image prompt for the sentence
- `D: 🤖 Generated Image URL` (URL): Google Drive shareable URL of the generated image
- `E: 🤖 Editor Keywords` (Text): Extracted keywords for editing guidance
- `F: 🤖 Status` (Text): Sentence processing status
  - Values: 'Pending', 'Processing', 'Image Generated', 'Complete'
- `G: 🤖 Word Count` (Number): Word count of script text
- `H: 🤖 Created Time` (Date): Auto-populated timestamp
- `I: 🤖 Last Updated` (Date): Auto-populated last modification time

<!-- ## Development Guidelines

### Service Dependencies
- Each service is autonomous but communicates through WorkflowService
- Services handle their own error states and logging
- AI services implement provider fallback (OpenAI → Anthropic)
- Google services implement proper authentication and rate limiting
- All file operations use absolute paths from project root

### Video Processing Notes
- FFmpeg operations are CPU/memory intensive
- Temporary files stored in `./temp/`, cleaned up automatically  
- Output videos target 2-3 minute duration with 1920x1080 resolution
- Text overlays use system fonts (Arial fallback)

### Testing Approach
- Manual testing via direct URL processing: `automation.processUrl(url)`
- Force processing methods available for each workflow stage
- Health check system monitors all external service connections
- System status accessible via `getSystemStatus()` method

### Common Issues & Solutions

#### Dependency Issues
- **Canvas Package**: Removed from dependencies due to Python build requirements
  - If canvas functionality needed, install Python 3.7+ and rebuild
  - Alternative: Use sharp for image processing
- **FFmpeg Path**: Uses ffmpeg-static for cross-platform compatibility
  - If issues occur, install system FFmpeg: `brew install ffmpeg` (macOS)

#### API Integration Issues
- **API Rate Limits**: All services implement intelligent retry with exponential backoff
  - YouTube API: 10,000 requests/day free tier
  - OpenAI: Rate limits vary by tier, implement queuing
  - Google APIs: Usually sufficient for normal usage
- **Authentication Failures**: 
  - Check .env file formatting (especially GOOGLE_PRIVATE_KEY newlines)
  - Verify service account permissions for Google Drive and Google Sheets
  - Ensure Google service account has proper API access and sharing permissions

#### Performance Issues
- **Memory Usage**: Video processing can spike to 1-2GB per concurrent operation
  - Monitor with: `process.memoryUsage()`
  - Adjust CONCURRENT_WORKERS in .env (default: 4)
- **Processing Timeouts**: Long-running operations may timeout
  - Increase timeout values in service configurations
  - Implement progress tracking for long operations

#### Error Handling Patterns
```javascript
// Retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
    }
  }
};

// Service health check
const checkServiceHealth = async (service) => {
  try {
    return await service.healthCheck();
  } catch (error) {
    logger.error(\`Service \${service.constructor.name} unhealthy:\`, error);
    return false;
  }
};
```

## File Structure Context

```
src/
├── config/config.js        # Environment variable loading & validation
├── services/               # Business logic layer
│   ├── workflowService.js  # Main orchestrator (400+ lines)
│   ├── aiService.js        # AI generation logic (417+ lines)  
│   ├── videoService.js     # FFmpeg video operations (329+ lines)
│   ├── googleSheetsService.js # Database operations with Google Sheets (300+ lines)
│   ├── googleDriveService.js # File management with Google Drive (261+ lines)
│   ├── telegramService.js  # Notifications (236+ lines)
│   └── youtubeService.js   # Video extraction (143+ lines)
├── utils/logger.js         # Winston logging configuration
└── index.js               # Main application with cron scheduling
```

### Output Directories
- `logs/` - Application and error logs
- `temp/` - Temporary processing files (auto-cleaned)
- `output/` - Final video assets before Google Drive upload

## Operational Notes

### Production Deployment
- System designed for continuous operation with cron scheduling
- Supports graceful shutdown for maintenance
- Logs provide detailed operation tracking
- Telegram integration enables remote monitoring

### Performance Characteristics
- Sequential processing: ~60 minutes per video
- Designed for 100-500 videos/month throughput
- Memory usage scales with concurrent video processing
- AI operations are the primary cost and time bottleneck

### Cost Management
- Primary costs: AI API usage ($30-80/month for 200-500 videos)
  - OpenAI GPT-4o-mini: $0.15/1M tokens (script generation)
  - OpenAI DALL-E 3: $0.04-0.08/image (visual assets)
  - Anthropic Claude: $3/1M tokens (fallback AI)
- YouTube API free tier usually sufficient (10,000 requests/day)
- Google APIs have generous free quotas:
  - Google Sheets API: 300 requests/minute per project
  - Google Drive API: 1,000 requests/100 seconds per user
- Infrastructure costs minimal ($25-50/month)
- Google Workspace not required (free Google account sufficient)

### Monitoring & Debugging

#### Logging Strategy
```javascript
// Log levels: error, warn, info, debug
logger.info('Processing started', { videoId, stage: 'extraction' });
logger.error('Processing failed', { videoId, error: error.message, stack: error.stack });

// Performance monitoring
const startTime = Date.now();
// ... operation
logger.info('Operation completed', { 
  videoId, 
  duration: Date.now() - startTime,
  memoryUsage: process.memoryUsage()
});
```

#### Health Check Implementation
```javascript
// Service health checks
const healthChecks = {
  youtube: () => youtubeService.testConnection(),
  googleSheets: () => googleSheetsService.testConnection(),
  googleDrive: () => googleDriveService.testConnection(),
  openai: () => aiService.testConnection(),
  telegram: () => telegramService.testConnection()
};

// System health endpoint
app.get('/health', async (req, res) => {
  const results = await Promise.allSettled(
    Object.entries(healthChecks).map(async ([name, check]) => ({
      service: name,
      healthy: await check()
    }))
  );
  res.json({ healthy: results.every(r => r.value.healthy), checks: results });
});
```

### Security Considerations
- Store API keys in .env file (never commit to git)
- Use service accounts with minimal required permissions
- Implement rate limiting to prevent API abuse
- Validate all external inputs (YouTube URLs, user data)
- Log security events and API usage patterns
- Rotate API keys periodically
- Monitor for unusual usage patterns or costs

## Advanced Development Patterns

### Service Extension Pattern
```javascript
// Extending existing services
class EnhancedAIService extends AIService {
  constructor() {
    super();
    this.cache = new Map(); // Add caching
  }
  
  async generateAttractiveScript(transcript, metadata) {
    const cacheKey = `script_${metadata.videoId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = await super.generateAttractiveScript(transcript, metadata);
    this.cache.set(cacheKey, result);
    return result;
  }
}
```

### Workflow Customization
```javascript
// Custom workflow stages
const customWorkflow = {
  async processVideo(videoData) {
    const stages = [
      this.extractMetadata,
      this.generateContent,
      this.createVisuals,
      this.assembleVideo,
      this.uploadAssets
    ];
    
    for (const stage of stages) {
      try {
        await stage.call(this, videoData);
        await this.updateStatus(videoData.id, stage.name);
      } catch (error) {
        await this.handleStageError(videoData, stage.name, error);
        break;
      }
    }
  }
};
```

### Testing Patterns
```javascript
// Service mocking for tests
const mockYouTubeService = {
  getVideoMetadata: jest.fn().mockResolvedValue({
    title: 'Test Video',
    description: 'Test Description',
    channelTitle: 'Test Channel'
  }),
  getTranscript: jest.fn().mockResolvedValue('Test transcript')
};

// Integration test example
describe('WorkflowService Integration', () => {
  test('processes video end-to-end', async () => {
    const mockVideo = { youtubeUrl: 'https://youtube.com/watch?v=test' };
    const result = await workflowService.processSingleVideo(mockVideo);
    
    expect(result.status).toBe('completed');
    expect(result.assets).toHaveProperty('videoPath');
    expect(result.assets).toHaveProperty('thumbnailPath');
  });
});
```

## Troubleshooting Guide

### Service Connection Issues
```bash
# Test individual services
node -e "
import('./src/services/youtubeService.js').then(async (service) => {
  const ys = new service.default();
  try {
    await ys.getVideoMetadata('dQw4w9WgXcQ');
    console.log('YouTube service: OK');
  } catch (e) {
    console.error('YouTube service: FAILED', e.message);
  }
});"

# Test Google Sheets service
node -e "
import('./src/services/googleSheetsService.js').then(async (service) => {
  const gs = new service.default();
  try {
    await gs.testConnection();
    console.log('Google Sheets service: OK');
  } catch (e) {
    console.error('Google Sheets service: FAILED', e.message);
  }
});"

# Test Google Drive service
node -e "
import('./src/services/googleDriveService.js').then(async (service) => {
  const gd = new service.default();
  try {
    await gd.testConnection();
    console.log('Google Drive service: OK');
  } catch (e) {
    console.error('Google Drive service: FAILED', e.message);
  }
});"
```

### Memory Leak Detection
```bash
# Monitor memory usage during processing
node --inspect src/index.js
# Then open chrome://inspect in browser
```

### Performance Profiling
```javascript
// Add to service methods
const { performance } = require('perf_hooks');

async function profiledMethod() {
  const start = performance.now();
  try {
    const result = await originalMethod();
    return result;
  } finally {
    const duration = performance.now() - start;
    logger.info(`Method completed in ${duration.toFixed(2)}ms`);
  }
}
``` -->

### Common Error Patterns & Solutions
1. **Rate Limit Exceeded**: All services implement exponential backoff with 5-layer fallback
2. **VideoID Not Found**: Use proper Google Sheets row identification with VID-XX format
3. **Image Generation Budget**: DALL-E 3 with cost tracking and 5-image limit per video
4. **Workflow Interruption**: Smart resume capability handles "Processing", "Generating Images" states
5. **Google Drive Upload**: Retry mechanism with exponential backoff for file uploads
6. **API Authentication**: Enhanced .env validation and health checks for Google APIs
7. **File System Errors**: Ensure temp/ and output/ directories writable
8. **Network Timeouts**: 30s timeout for image downloads, 2s delays between generations
9. **Google Sheets API Limits**: Batch operations and intelligent retry for quota management
10. **Google Drive Permissions**: Ensure service account has proper folder access and sharing permissions

### Recent Enhancements (Latest Session)
- **VideoID Format**: Clean VID-XX format in Telegram notifications using Google Sheets row identification
- **Enhanced Image Quality**: Restored DALL-E 3 with 10 professional visual enhancement requirements
- **Smart Workflow Resume**: Automatic detection and continuation of interrupted processing at any stage
- **Google Drive Integration**: Complete cloud storage with shareable URLs in Script Detail sheets
- **Google Sheets Database Migration**: Full migration from Notion to Google Sheets with hierarchical structure
- **Service Account Integration**: Seamless Google APIs integration with proper permissions and access control
- **Google Sheets Database**: Hierarchical sheet structure (Master → Video Info → Script Details)
- **Cost Optimization**: Full flow cost summaries with DALL-E 2/3 savings analysis
- **5-Layer Fallback System**: Ultimate reliability for video processing pipeline
- **Professional Image Generation**: Enhanced prompts with lighting, composition, color palette specifications
- **🆕 CLEAN VOICE SCRIPT Feature**: Automatic generation of clean voice scripts for voice generation
  - **Video Info Sheet Enhancement**: Added CLEAN VOICE SCRIPT field containing pure voice text
  - **Script Extraction**: Automatically combines script sentences from breakdown into clean, flowing text
  - **File Generation**: Creates `voice_script.txt` with properly formatted content and metadata
  - **Google Drive Upload**: Uploads voice script file to video folder with public access permissions
  - **Workflow Integration**: Automatically triggered during Video Info sheet population
  - **API Methods**: `extractCleanVoiceScript()` and `createAndUploadVoiceScript()` for manual usage
- **Workflow Streamlining**: Removed automated video generation - workflow now ends after image generation
- **Voice Status Tracking**: Added Voice Status field for manual voice generation progress tracking

### Production Deployment Checklist
- [ ] All environment variables configured (including Google Drive and Sheets)
- [ ] API keys tested and working (OpenAI, Google Sheets API, Google Drive API, Telegram, YouTube)
- [ ] Google Sheets structure matches exactly with Master Sheet schema (VID-XX VideoID format)
- [ ] Google Drive folder configured with proper service account permissions
- [ ] Google service account has access to target Google Sheets and Drive folders
- [ ] Telegram bot configured and accessible with VideoID notification format
- [ ] Voice Status field added to Master Sheet schema
- [ ] Log directory writable with rotation policy
- [ ] System resources adequate (CPU, memory, disk for image processing)
- [ ] Health checks passing for all services including Google APIs
- [ ] Error notifications working with cost summaries
- [ ] Cost tracking and budget limits configured ($0.50 per video default)
- [ ] Test video processing with sample URL to verify end-to-end Google integration