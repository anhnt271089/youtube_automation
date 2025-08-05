# YouTube Content Automation System

A comprehensive Node.js automation system that transforms YouTube videos into optimized short-form content using AI, with full workflow management through Notion, Google Drive, and Telegram notifications.

## 🎯 Features

### Core Automation Workflow
- **YouTube Integration**: Extract metadata, transcripts, thumbnails from any YouTube URL
- **Notion Database**: Store and track video processing status with approval workflows
- **AI Content Enhancement**: Generate attractive scripts, optimized descriptions, and SEO titles
- **Keyword Research**: Automated SEO keyword analysis and application
- **Google Drive Organization**: Automatic folder creation and file management
- **Script Breakdown**: Convert scripts into sentence-level segments in Google Sheets
- **AI Image Generation**: Create custom images for each script segment using DALL-E
- **Thumbnail Generation**: AI-generated custom thumbnails optimized for engagement
- **Video Assembly**: Combine images and text overlays into 2-3 minute videos
- **Telegram Notifications**: Real-time updates and approval requests

### Workflow Stages
1. **Simplified Input**: Just paste YouTube URL in Notion - all metadata auto-populated
2. **AI Enhancement**: Generate optimized scripts, descriptions, and titles
3. **Drive Setup**: Create organized folder structure for each video
4. **Script Approval**: Manual review step with Telegram notifications
5. **Image Generation**: AI-generated visuals for each script segment
6. **Video Assembly**: Create final 2-3 minute video with overlays
7. **Final Delivery**: Upload to Google Drive with complete assets

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- FFmpeg installed on system
- API keys for required services (see Configuration section)

### Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/anhnt271089/youtube_automation.git
   cd youtube_automation
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys (see Configuration section)
   ```

3. **Start the System**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Required API Keys

Create a `.env` file with the following credentials:

```env
# YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key_here

# Google Service Account (for Drive & Sheets)
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key_here
GOOGLE_DRIVE_FOLDER_ID=your_main_drive_folder_id

# Notion Integration
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### API Setup Instructions

1. **YouTube API**: 
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Enable YouTube Data API v3
   - Create credentials and copy API key

2. **Google Services**:
   - Create a service account in Google Cloud Console
   - Download the JSON key file
   - Share your Google Drive folder with the service account email
   - Extract `client_email` and `private_key` from JSON

3. **Notion**:
   - Create an integration at [Notion Developers](https://developers.notion.com)
   - Create a database with required properties (see Database Schema)
   - Share database with your integration

4. **AI Services**:
   - OpenAI: Get API key from [OpenAI Platform](https://platform.openai.com)
   - Anthropic: Get API key from [Anthropic Console](https://console.anthropic.com)

5. **Telegram**:
   - Create bot with [@BotFather](https://t.me/botfather)
   - Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)

### Notion Database Schema

**🎯 Simplified Input - Only One Field Required!**

**Manual Input:**
- **YouTube URL** (URL): Original video URL - **ONLY FIELD YOU NEED TO FILL**

**Auto-Populated Fields:**
- **VideoID** (Text): Sequential unique identifier - auto-generated starting from VID_0001, VID_0002, etc.
- **Title** (Title): Video title (extracted from YouTube)
- **Status** (Select): Processing status - defaults to 'New' and auto-updates during workflow. Options: 'New', 'Processing', 'Script Generated', 'Approved', 'Video Generated', 'Completed', 'Error'
- **Channel** (Text): YouTube channel name (extracted from YouTube)
- **YouTube Video ID** (Text): YouTube video ID (extracted from URL)
- **Duration** (Text): Video duration (extracted from YouTube)
- **View Count** (Number): Video view count (extracted from YouTube)
- **Published Date** (Date): Video publish date (extracted from YouTube)
- **Optimized Title** (Text): AI-generated title
- **Optimized Description** (Text): AI-generated description
- **Keywords** (Multi-select): SEO keywords
- **Script Approved** (Checkbox): Manual approval flag
- **Drive Folder** (URL): Google Drive folder link
- **Created Time** (Created time): Auto-populated by Notion
- **Last Edited Time** (Last edited time): Auto-populated by Notion

**How it works:** Simply paste a YouTube URL and the system automatically extracts and populates all metadata!

## 🔄 Automated Scheduling

The system runs on automatic cron schedules:

- **New Videos**: Every 10 minutes
- **Script Processing**: Every 15 minutes  
- **Video Generation**: Every 20 minutes
- **Approval Timeouts**: Every hour
- **Daily Summary**: 9:00 AM daily
- **Health Checks**: Every 6 hours

## 🎮 Manual Operations

### Process Individual URL
```javascript
import YouTubeAutomation from './src/index.js';

const automation = new YouTubeAutomation();
await automation.initialize();

// Process a specific YouTube URL
const result = await automation.processUrl('https://www.youtube.com/watch?v=VIDEO_ID');
```

### Force Processing
```bash
# In Node.js console or create a script
automation.forceProcessNewVideos();      // Process all new videos
automation.forceProcessApprovedScripts(); // Process approved scripts
automation.forceGenerateVideos();        // Generate final videos
```

## 📊 Monitoring & Notifications

### Telegram Notifications Include:
- 🎬 Video processing started
- ✍️ Script generation completed
- ⚠️ Manual approval requests
- 🖼️ Image generation progress
- 🎨 Thumbnail generation
- 🎉 Final video completion
- ❌ Error notifications
- 📊 Daily processing summaries

### System Status
Check system health and statistics:
```javascript
const status = automation.getSystemStatus();
console.log(status);
```

## 💰 Cost Estimation

**Monthly operational costs** (for 200-500 videos):

- **AI Services**: $30-80
  - OpenAI GPT-4o mini: $0.15/1M tokens
  - DALL-E 3: $0.04-0.08/image
  - Anthropic Claude: $0.25/1M tokens

- **Infrastructure**: $25-50
  - VPS hosting
  - Storage costs
  - Bandwidth

- **APIs**: $10-20
  - YouTube API (free quota usually sufficient)
  - Google Drive/Sheets (free)

**Total**: ~$65-150/month for 200-500 videos

## 🏗️ Architecture

### Service Structure
```
src/
├── config/          # Environment configuration
├── services/        # Core business logic
│   ├── youtubeService.js      # YouTube API integration
│   ├── notionService.js       # Notion database management
│   ├── googleDriveService.js  # Drive & Sheets operations
│   ├── aiService.js           # OpenAI & Anthropic integration
│   ├── telegramService.js     # Telegram notifications
│   ├── videoService.js        # Video processing & FFmpeg
│   └── workflowService.js     # Orchestration logic
├── utils/           # Logging and utilities
└── index.js         # Main application entry
```

### Processing Flow
1. **Simplified Input**: Just paste YouTube URL in Notion (system auto-populates all fields)
2. **Auto-Extraction**: Video metadata, transcript, thumbnails automatically extracted
3. **AI Enhancement**: Scripts, descriptions, titles, keywords generated
4. **Organization**: Google Drive folders and Google Sheets created
5. **Approval**: Manual script review via Telegram notifications
6. **Generation**: AI images and custom thumbnails created
7. **Assembly**: Final video creation with FFmpeg
8. **Delivery**: Upload to Drive with completion notifications

## 🛠️ Development

### Local Development
```bash
npm run dev          # Development mode with auto-restart
npm run lint         # Code linting
npm run test         # Run tests
```

### Logging
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Console output in development mode

### Error Handling
- Comprehensive error logging
- Telegram error notifications
- Automatic retry mechanisms
- Graceful degradation for API failures

## 📝 Scripts Available

```bash
npm start            # Production mode
npm run dev          # Development mode  
npm run lint         # ESLint code checking
npm run test         # Jest testing
npm run typecheck    # TypeScript checking
```

## 🚨 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

2. **Google API Authentication**
   - Ensure service account has proper permissions
   - Check that Drive folder is shared with service account email
   - Verify private key format (replace \\n with actual newlines)

3. **Notion Database Issues**
   - Confirm all required properties exist in database
   - Verify integration has access to database
   - Check property name spelling and types

4. **Memory Issues**
   - Monitor video processing memory usage
   - Adjust concurrent worker limits in config
   - Consider adding swap space for video processing

### Debug Mode
Set environment variable for detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Documentation

- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Notion API](https://developers.notion.com)
- [Google Drive API](https://developers.google.com/drive)
- [OpenAI API](https://platform.openai.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

---

**Built with ❤️ for content creators who want to automate their video workflows**