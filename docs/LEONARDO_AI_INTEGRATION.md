# Leonardo AI Integration Guide

This document provides a comprehensive guide for the Leonardo AI integration in the YouTube automation system, replacing DALL-E as the primary image generation provider.

## Overview

The Leonardo AI integration provides:
- **Cost-effective image generation** (~$0.0018 per image vs $0.04 for DALL-E 3)
- **Multiple high-quality models** (Phoenix, Vision XL, Diffusion XL, etc.)
- **Advanced features** (Alchemy V2, preset styles, fine-tuned models)
- **Async generation** with intelligent polling
- **Comprehensive error handling** and fallback support

## Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```env
# Leonardo AI Configuration
LEONARDO_API_KEY=your_leonardo_api_key_here
LEONARDO_DEFAULT_MODEL=leonardo-phoenix
LEONARDO_PRESET_STYLE=CINEMATIC
LEONARDO_ENABLE_ALCHEMY=true
LEONARDO_CREDITS_PER_GENERATION=7
LEONARDO_MAX_RETRIES=3
LEONARDO_REQUEST_TIMEOUT=60000

# Image Generation Settings
IMAGE_PROVIDER=leonardo
IMAGE_MODEL=leonardo-phoenix
ENABLE_IMAGE_GENERATION=true
ENABLE_THUMBNAIL_GENERATION=true
```

### Getting Your Leonardo AI API Key

1. Visit [Leonardo AI](https://leonardo.ai)
2. Sign up or log in to your account
3. Subscribe to an API plan (Basic: $9/month for 3,500 credits)
4. Navigate to API Access in your dashboard
5. Create a new API key
6. Copy the key to your environment variables

## Supported Models

### Leonardo Phoenix (Recommended for Thumbnails)
- **Model ID**: `b24e16ff-06e3-43eb-8d33-4416c2d75876`
- **Key**: `leonardo-phoenix`
- **Max Resolution**: 1472x832
- **Best For**: Photorealistic thumbnails, high prompt adherence
- **Supports**: Alchemy V2, Cinematic style

### Leonardo Vision XL
- **Model ID**: `5c232a9e-9061-4777-980a-ddc8e65647c6`
- **Key**: `leonardo-vision-xl`
- **Max Resolution**: 1024x1024
- **Best For**: Portrait photography, detailed scenes
- **Supports**: Alchemy V2, Photography style

### Leonardo Diffusion XL
- **Model ID**: `1e60896f-3c26-4296-8ecc-53e2afecc132`
- **Key**: `leonardo-diffusion-xl`
- **Max Resolution**: 1024x1024
- **Best For**: Creative artwork, artistic styles
- **Supports**: Alchemy V2, Creative style

### Leonardo Kino XL
- **Model ID**: `aa77f04e-3eec-4034-9c07-d0f619684628`
- **Key**: `leonardo-kino-xl`
- **Max Resolution**: 1024x1024
- **Best For**: Cinematic visuals, movie-style imagery
- **Supports**: Alchemy V2, Cinematic style

### DreamShaper v7
- **Model ID**: `ac614f96-1082-45bf-be9d-757f2d31c174`
- **Key**: `dreamshaper-v7`
- **Max Resolution**: 1024x1024
- **Best For**: Fantasy, creative content
- **Supports**: Basic generation (no Alchemy)

## Features

### Alchemy V2
Leonardo's premium enhancement feature that provides:
- **1.75x larger output resolution**
- **Enhanced image quality and detail**
- **Better prompt adherence**
- **Improved consistency**

**Cost**: Same credit cost, automatically enabled for SDXL models

### Preset Styles
Available preset styles for different content types:
- `CINEMATIC`: Movie-like, dramatic lighting
- `PHOTOGRAPHY`: Professional photo style
- `CREATIVE`: Artistic and experimental
- `VIBRANT`: High saturation, energetic
- `NONE`: No style preset applied

### Image Dimensions
- **Minimum**: 32x32 pixels
- **Maximum**: 1024x1024 pixels (model dependent)
- **Requirements**: Must be divisible by 8
- **Recommended for YouTube**: 1024x1024 or 1472x832 (Phoenix)

## Cost Analysis

### Leonardo AI vs DALL-E Pricing

| Model | Provider | Cost per Image | Quality | Speed |
|-------|----------|----------------|---------|--------|
| Leonardo Phoenix | Leonardo AI | $0.0018 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Leonardo Vision XL | Leonardo AI | $0.0018 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| DALL-E 3 Standard | OpenAI | $0.040 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| DALL-E 3 HD | OpenAI | $0.080 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| DALL-E 2 | OpenAI | $0.020 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Cost Savings**: Up to **95.5% cheaper** than DALL-E 3 HD

### Credit System
Leonardo AI uses a credit-based system:
- **API Basic Plan**: $9/month for 3,500 credits
- **Typical Generation**: 7 credits (varies by model/settings)
- **Images per Month**: ~500 images for $9
- **Cost per Image**: ~$0.0018

## Usage Examples

### Basic Thumbnail Generation
```javascript
const aiService = new AIService();

const thumbnail = await aiService.generateThumbnail(
  "How to Master Productivity in 2024",
  "Learn the secrets of time management...",
  {
    videoId: "VID-001",
    model: "leonardo-phoenix",
    provider: "leonardo"
  }
);

console.log(`Thumbnail URL: ${thumbnail.url}`);
console.log(`Cost: $${thumbnail.cost.toFixed(4)}`);
```

### Custom Image Generation
```javascript
const image = await aiService.generateImage(
  "Professional business meeting in modern office, high quality, cinematic lighting",
  {
    model: "leonardo-vision-xl",
    provider: "leonardo",
    size: "1024x1024",
    videoId: "VID-001"
  }
);
```

### Model-Specific Configuration
```javascript
const leonardoOptions = {
  model: "leonardo-kino-xl",
  width: 1024,
  height: 1024,
  enableAlchemy: true,
  presetStyle: "CINEMATIC"
};

const result = await aiService.generateLeonardoImage(prompt, leonardoOptions);
```

## Integration Architecture

### Flow Diagram
```
1. Prompt Enhancement (GPT-4o) → 
2. Leonardo AI Generation → 
3. Polling for Completion → 
4. Download Image → 
5. Upload to Google Drive → 
6. Cost Tracking → 
7. Return Result
```

### Error Handling
The system includes comprehensive error handling:
1. **Leonardo AI Failures**: Automatic fallback to OpenAI DALL-E
2. **API Rate Limits**: Intelligent retry with exponential backoff
3. **Timeout Handling**: 60-second timeout with polling
4. **Budget Controls**: Cost tracking and budget enforcement
5. **Storage Failures**: Google Drive with Digital Ocean fallback

## Testing

### Run Integration Test
```bash
# Test Leonardo AI integration
node tools/test-leonardo-ai-integration.js

# Test with specific video
node tools/test-optimized-thumbnail-generation.js VID-0001
```

### Health Check
```javascript
const aiService = new AIService();
const isHealthy = await aiService.healthCheck();
// Checks Claude, OpenAI, and Leonardo AI APIs
```

## Performance Optimization

### Best Practices
1. **Use Leonardo Phoenix** for thumbnails (best quality/cost ratio)
2. **Enable Alchemy V2** for enhanced quality
3. **Batch generations** to minimize API calls
4. **Cache results** to avoid regeneration
5. **Monitor costs** with built-in tracking

### Recommended Settings
```env
IMAGE_MODEL=leonardo-phoenix
IMAGE_PROVIDER=leonardo
LEONARDO_ENABLE_ALCHEMY=true
LEONARDO_PRESET_STYLE=CINEMATIC
IMAGE_WIDTH=1024
IMAGE_HEIGHT=1024
```

## Migration from DALL-E

### Automatic Migration
The system automatically detects and uses Leonardo AI when configured:
```env
IMAGE_PROVIDER=leonardo  # Use Leonardo by default
IMAGE_MODEL=leonardo-phoenix  # Default model
```

### Fallback Support
If Leonardo AI fails, the system automatically falls back to DALL-E:
```javascript
// Automatic provider detection
const shouldUseLeonardo = options.provider === 'leonardo' || 
                         options.model.startsWith('leonardo-');

if (shouldUseLeonardo) {
  // Try Leonardo AI
} else {
  // Use OpenAI DALL-E
}
```

## Monitoring and Debugging

### Cost Tracking
```javascript
const costSummary = aiService.getCostSummary();
console.log(`Total Cost: $${costSummary.totalCost}`);
console.log(`Leonardo Savings: $${costSummary.costSavingsVsDallE3}`);
```

### Debug Logs
Enable debug logging for detailed information:
```env
LOG_LEVEL=debug
```

### Error Monitoring
Monitor these metrics:
- **Generation Success Rate**
- **Average Generation Time**
- **API Response Times**
- **Cost per Video**
- **Storage Upload Success**

## Troubleshooting

### Common Issues

#### "Leonardo AI API key not configured"
**Solution**: Add `LEONARDO_API_KEY` to your environment variables

#### "Unsupported Leonardo AI model"
**Solution**: Use one of the supported model keys: `leonardo-phoenix`, `leonardo-vision-xl`, etc.

#### "Generation timeout"
**Solution**: 
- Check Leonardo AI service status
- Increase `LEONARDO_REQUEST_TIMEOUT`
- Verify account has sufficient credits

#### "Budget exceeded"
**Solution**: 
- Increase `MAX_IMAGE_COST_PER_VIDEO`
- Monitor cost tracking in logs
- Use more cost-effective models

#### "Dimensions not supported"
**Solution**: Ensure dimensions are:
- Between 32 and 1024 pixels
- Divisible by 8
- Within model limits

## Advanced Configuration

### Custom Model Configuration
```javascript
// Add new Leonardo model
this.leonardoModels['custom-model'] = {
  id: 'your-model-id',
  name: 'Custom Model',
  maxWidth: 1024,
  maxHeight: 1024,
  supportsAlchemy: true,
  defaultPresetStyle: 'CREATIVE'
};
```

### Webhook Integration (Future Enhancement)
Configure webhooks to receive generation notifications:
```env
LEONARDO_WEBHOOK_URL=https://your-domain.com/webhook
```

## Support and Resources

### Documentation
- [Leonardo AI API Docs](https://docs.leonardo.ai)
- [Model Compatibility Guide](https://docs.leonardo.ai/docs/elements-and-model-compatibility)
- [Pricing Calculator](https://docs.leonardo.ai/docs/plan-with-the-pricing-calculator)

### Community
- [Leonardo AI Discord](https://discord.gg/leonardo-ai)
- [GitHub Issues](https://github.com/your-repo/issues)

### Contact
For integration support, create an issue in the GitHub repository with:
- Error messages and logs
- Environment configuration
- Steps to reproduce
- Expected vs actual behavior

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Compatibility**: Leonardo AI API v1, YouTube Automation System v2.0+