# Script Length Control Feature

## Overview

This feature adds configurable control over YouTube script length to ensure consistent video durations and optimal viewer retention.

## Configuration

### Environment Variable
```env
# Maximum number of sentences in generated scripts to control video length
# Typical video lengths: 45-60 sentences for ~3-5 min videos, 60-80 for ~5-7 min videos
# Set to 0 for no limit (not recommended for consistency)
MAX_SCRIPT_SENTENCES=60
```

### Config Access
```javascript
config.app.maxScriptSentences // Default: 60 sentences
```

## How It Works

### 1. Script Generation Constraints
Both AI script generation prompts (Claude Sonnet 4 and GPT-4o-mini fallback) include sentence limits:

```javascript
📏 SCRIPT LENGTH REQUIREMENT:
- Maximum ${config.app.maxScriptSentences} sentences to ensure proper video length
- Each sentence should be substantial and meaningful
- Balance depth with conciseness for optimal viewer retention
```

### 2. Script Breakdown Enforcement
The `breakdownScriptIntoSentences()` method enforces the limit at two levels:

1. **Prompt-level**: Instructs AI to limit breakdown to maximum sentences
2. **Code-level**: Hard limit using `Array.slice()` as safety measure

```javascript
const limitedSentences = sentences.slice(0, maxSentences);
if (sentences.length > maxSentences) {
  logger.warn(`Script breakdown exceeded limit: ${sentences.length} sentences > ${maxSentences} max. Trimmed to ${limitedSentences.length} sentences.`);
}
```

## Video Length Estimation

Based on typical narration speed:
- **Average**: ~3.5 seconds per sentence
- **60 sentences**: ~3.5 minutes
- **80 sentences**: ~4.7 minutes
- **45 sentences**: ~2.6 minutes

## Recommended Settings

| Video Type | Sentence Range | Estimated Duration | Use Case |
|------------|----------------|-------------------|-----------|
| Short Form | 30-45 | 1.75-2.6 min | Quick tips, highlights |
| Standard | 45-60 | 2.6-3.5 min | Tutorials, explanations |
| Extended | 60-80 | 3.5-4.7 min | Deep dives, comprehensive guides |
| Long Form | 80+ | 4.7+ min | Detailed analysis, storytelling |

## Implementation Details

### Files Modified
- `.env.example`: Added MAX_SCRIPT_SENTENCES configuration
- `config/config.js`: Added maxScriptSentences config option
- `src/services/aiService.js`: 
  - Updated script generation prompts with length constraints
  - Enhanced `breakdownScriptIntoSentences()` with limit enforcement

### Safety Features
1. **Double enforcement**: Both AI prompt and code-level limits
2. **Graceful degradation**: Trims excess sentences rather than failing
3. **Logging**: Warns when limits are exceeded
4. **Quality preservation**: Maintains sentence completeness and flow

## Testing

Use the test tool to verify configuration:
```bash
node tools/test-script-sentence-limit.js
```

The test validates:
- Configuration loading
- Sentence limit enforcement
- Sentence quality and completeness
- Video length estimation
- Optimal length recommendations

## Benefits

### For Creators
- **Consistent video lengths** for better audience expectations
- **Improved retention** through optimal duration targeting
- **Better algorithm performance** with consistent engagement metrics

### For Automation
- **Predictable processing times** for voice generation and editing
- **Cost control** for AI-generated content
- **Resource planning** for video production workflows

### For Viewers
- **Consistent viewing experience** across videos
- **Optimal information density** without overwhelming or underwhelming
- **Better completion rates** with appropriate video lengths

## Advanced Usage

### Dynamic Length Control
For different content types, you can set different limits:

```javascript
// Short tips series
process.env.MAX_SCRIPT_SENTENCES = '45';

// Comprehensive tutorials  
process.env.MAX_SCRIPT_SENTENCES = '75';

// Quick highlights
process.env.MAX_SCRIPT_SENTENCES = '30';
```

### Analytics Integration
Track how sentence count affects performance:
- Average view duration vs sentence count
- Engagement rate by video length
- Subscriber conversion by content density

### A/B Testing
Test different sentence limits to find optimal length for your audience:
- Week 1: 45 sentences (short format)
- Week 2: 60 sentences (standard format) 
- Week 3: 75 sentences (extended format)

Compare metrics and adjust MAX_SCRIPT_SENTENCES accordingly.

## Troubleshooting

### Script Too Short
- Increase MAX_SCRIPT_SENTENCES
- Check if AI is generating complete content
- Verify source material has sufficient depth

### Script Too Long  
- Decrease MAX_SCRIPT_SENTENCES
- Review if content can be split into multiple videos
- Check for repetitive content in generation

### Poor Sentence Quality
- Review AI generation prompts
- Check script breakdown logic
- Verify sentence completeness validation

## Future Enhancements

### Potential Improvements
1. **Dynamic length based on topic complexity**
2. **Audience retention-based optimization**
3. **Platform-specific length targets** (YouTube vs TikTok)
4. **Real-time length adjustment** based on performance data
5. **Content type classification** with appropriate length profiles

### Integration Opportunities
- **Voice generation time estimation**
- **Video editing workflow planning**
- **Thumbnail concept scaling**
- **Publishing schedule optimization**