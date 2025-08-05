# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Important
- Always use best fit sub agent to do the task
- Task need pass QA. QC before mark done
- Update all related document if needed when requirement change 


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

This is a comprehensive YouTube content automation system built with Node.js that transforms YouTube videos into optimized short-form content using AI. The system orchestrates a complete workflow from URL processing to final video delivery through Notion, Google Drive, and Telegram integrations.

## Development Commands

### Essential Commands
```bash
npm start              # Start production system with cron scheduling
npm run dev            # Development mode with nodemon auto-restart
npm run lint           # ESLint code checking - MUST pass before commits
npm run typecheck      # TypeScript validation - MUST pass before commits
npm test               # Run Jest test suite - MUST pass before commits
```

### System Operations
```bash
# Test system functionality with unified test script
node test-single-run.js health                    # Health check only
node test-single-run.js all                       # Run all services once
node test-single-run.js single-video <url>        # Process specific video
node test-single-run.js new-videos               # Process new videos
node test-single-run.js approved-scripts         # Process approved scripts
node test-single-run.js video-generation         # Run video generation

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
├── YouTubeService      # Video metadata/transcript extraction  
├── NotionService       # Database operations & approval workflows
├── GoogleDriveService  # File organization & Google Sheets integration
├── AIService          # OpenAI/Anthropic content generation
├── TelegramService    # Notifications & manual approvals
└── VideoService       # FFmpeg video processing & assembly
```

### Processing Pipeline
1. **Input Stage**: YouTube URLs tracked in Notion database
2. **Extraction**: Video metadata, transcripts, thumbnails via YouTube API
3. **AI Enhancement**: Script optimization, descriptions, titles using GPT-4/Claude
4. **Organization**: Google Drive folder creation, Google Sheets script breakdown
5. **Approval**: Manual review workflow via Telegram notifications
6. **Generation**: AI image creation (DALL-E), thumbnail generation
7. **Assembly**: Video creation using FFmpeg with text overlays
8. **Delivery**: Final assets uploaded to Google Drive

### Key Design Patterns

#### Cron-Based Automation
- Multiple scheduled jobs run at different intervals (10-20 minutes)
- Each job processes different workflow stages independently
- Graceful shutdown handling with SIGINT/SIGTERM signals

#### Error Handling Strategy
- Comprehensive logging with Winston (logs/ directory)
- Telegram notifications for critical errors
- Per-video error tracking with retry mechanisms
- Status tracking in Notion database

#### State Management
- Notion database serves as primary state store
- Processing status: 'New' → 'Processing' → 'Script Generated' → 'Approved' → 'Completed'
- Manual approval gates prevent automated progression

## Configuration Requirements

### Environment Setup
The system requires extensive API integration. Copy `.env.example` to `.env` and configure:

**Critical Services:**
- YouTube Data API v3 (metadata extraction)
- Google Service Account (Drive/Sheets access)
- Notion Integration (database operations)
- OpenAI API (primary AI generation)
- Anthropic API (alternative AI provider)
- Telegram Bot (notifications/approvals)

### Notion Database Schema
**Manual Input Required:**
- `YouTube URL` (URL): Source video URL - **ONLY FIELD YOU NEED TO INPUT**

**Auto-Populated Fields:**
- `VideoID` (Formula): Internal unique identifier - auto-generated using `id()` formula
- `Title` (Title): Video title (extracted from YouTube)
- `Status` (Select): Workflow state tracking (defaults to 'New')
  - Options: 'New', 'Processing', 'Script Generated', 'Approved', 'Video Generated', 'Completed', 'Error'
- `Channel` (Text): YouTube channel name (extracted from YouTube)
- `YouTube Video ID` (Text): YouTube video ID (extracted from URL)
- `Duration` (Text): Video duration (extracted from YouTube)
- `View Count` (Number): Video view count (extracted from YouTube)
- `Published Date` (Date): Video publish date (extracted from YouTube)
- `Optimized Title` (Text): AI-generated title
- `Optimized Description` (Text): AI-generated description
- `Keywords` (Multi-select): SEO keywords
- `Script Approved` (Checkbox): Manual approval flag
- `Drive Folder` (URL): Generated Google Drive folder link
- `Created Time` (Created time): Auto-populated by Notion
- `Last Edited Time` (Last edited time): Auto-populated by Notion

<!-- ## Development Guidelines

### Service Dependencies
- Each service is autonomous but communicates through WorkflowService
- Services handle their own error states and logging
- AI services implement provider fallback (OpenAI → Anthropic)
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
  - Verify service account permissions for Google Drive
  - Ensure Notion integration has database access

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
│   ├── notionService.js    # Database operations (258+ lines)
│   ├── googleDriveService.js # File management (261+ lines)
│   ├── telegramService.js  # Notifications (236+ lines)
│   └── youtubeService.js   # Video extraction (143+ lines)
├── utils/logger.js         # Winston logging configuration
└── index.js               # Main application with cron scheduling
```

### Output Directories
- `logs/` - Application and error logs
- `temp/` - Temporary processing files (auto-cleaned)
- `output/` - Final video assets before Drive upload

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
- Google APIs have generous free quotas
- Infrastructure costs minimal ($25-50/month)

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
  notion: () => notionService.testConnection(),
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

### Common Error Patterns
1. **Rate Limit Exceeded**: Implement exponential backoff
2. **Memory Exhaustion**: Reduce CONCURRENT_WORKERS
3. **API Authentication**: Check .env file formatting
4. **File System Errors**: Ensure temp directories exist and are writable
5. **Network Timeouts**: Increase timeout values or implement retry logic

### Production Deployment Checklist
- [ ] All environment variables configured
- [ ] API keys tested and working  
- [ ] Notion database schema matches exactly
- [ ] Google Drive folder shared with service account
- [ ] Telegram bot configured and accessible
- [ ] FFmpeg installed and accessible
- [ ] Log directory writable
- [ ] System resources adequate (CPU, memory, disk)
- [ ] Health checks passing
- [ ] Error notifications working