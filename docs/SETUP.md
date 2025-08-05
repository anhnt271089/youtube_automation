# Setup Guide

## Quick Setup Checklist

### 1. Prerequisites
- [ ] Node.js 18+ installed
- [ ] FFmpeg installed on system
- [ ] Git installed

### 2. Installation
```bash
git clone https://github.com/anhnt271089/youtube_automation.git
cd youtube_automation
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 4. API Keys Setup

#### YouTube Data API v3
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable YouTube Data API v3
4. Create API key credentials
5. Add to `.env`: `YOUTUBE_API_KEY=your_key_here`

#### Google Service Account
1. In Google Cloud Console, go to IAM & Admin > Service Accounts
2. Create new service account
3. Download JSON key file
4. Extract `client_email` and `private_key` to `.env`
5. Share Google Drive folder with service account email

#### Notion Integration
1. Go to [Notion Developers](https://developers.notion.com)
2. Create new integration
3. Get integration token
4. Create database with required schema (see README.md)
5. Share database with integration
6. Add database ID to `.env`

#### OpenAI API
1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create API key
3. Add to `.env`: `OPENAI_API_KEY=your_key_here`

#### Anthropic API
1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create API key
3. Add to `.env`: `ANTHROPIC_API_KEY=your_key_here`

#### Telegram Bot
1. Message [@BotFather](https://t.me/botfather)
2. Create new bot with `/newbot`
3. Get bot token
4. Message [@userinfobot](https://t.me/userinfobot) to get chat ID
5. Add both to `.env`

### 5. Database Setup
1. Create Notion database with schema from README.md
2. Share database with your integration
3. Copy database ID from URL to `.env`

### 6. Testing
```bash
npm run lint      # Check code quality
npm run typecheck # Verify TypeScript
npm test          # Run test suite
npm start         # Start production system
```

### 7. Verification
- [ ] All API connections working
- [ ] Notion database accessible
- [ ] Google Drive folder shared
- [ ] Telegram notifications working
- [ ] FFmpeg available in PATH

## Troubleshooting

### Common Issues
1. **Config errors**: Check `.env` file formatting
2. **API failures**: Verify API keys and permissions
3. **FFmpeg issues**: Install with package manager
4. **Google auth**: Check service account permissions
5. **Notion access**: Verify integration and database sharing