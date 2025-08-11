import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';
import DigitalOceanService from './digitalOceanService.js';
import GoogleDriveService from './googleDriveService.js';
import axios from 'axios';
// import fs from 'fs';
// import path from 'path';

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
    
    this.digitalOceanService = new DigitalOceanService();
    this.googleDriveService = new GoogleDriveService();
    
    // Leonardo AI HTTP client
    this.leonardoClient = axios.create({
      baseURL: config.leonardo.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.leonardo.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: config.leonardo.requestTimeout
    });
    
    // Cost tracking
    this.costTracker = {
      totalCost: 0,
      imagesGenerated: 0,
      videoCosts: new Map()
    };
    
    // Model pricing (per operation)
    this.pricing = {
      // Image generation models
      'dall-e-2': 0.02,
      'dall-e-3': 0.04, // standard quality
      'dall-e-3-hd': 0.08, // HD quality
      
      // Leonardo AI models (based on API credits and plan pricing)
      'leonardo-phoenix': 0.0018, // ~7 credits at $9/3500 credits = $0.0018
      'leonardo-vision-xl': 0.0018,
      'leonardo-diffusion-xl': 0.0018,
      'leonardo-kino-xl': 0.0018,
      'dreamshaper-v7': 0.0018,
      
      // Claude models (estimated per enhancement) - Much cheaper!
      'claude-sonnet-prompt-enhancement': 0.0015, // Claude Sonnet cost per prompt enhancement (~85% cheaper)
      'gpt-4o-mini': 0.005 // For thumbnail prompt generation
    };
    
    // Leonardo AI model configurations
    this.leonardoModels = {
      'leonardo-phoenix': {
        id: 'b24e16ff-06e3-43eb-8d33-4416c2d75876', // Phoenix 1.0 model ID
        name: 'Leonardo Phoenix',
        maxWidth: 1472,
        maxHeight: 832,
        supportsAlchemy: true,
        defaultPresetStyle: 'CINEMATIC'
      },
      'leonardo-vision-xl': {
        id: '5c232a9e-9061-4777-980a-ddc8e65647c6', // Vision XL model ID
        name: 'Leonardo Vision XL',
        maxWidth: 1024,
        maxHeight: 1024,
        supportsAlchemy: true,
        defaultPresetStyle: 'PHOTOGRAPHY'
      },
      'leonardo-diffusion-xl': {
        id: '1e60896f-3c26-4296-8ecc-53e2afecc132', // Diffusion XL model ID
        name: 'Leonardo Diffusion XL',
        maxWidth: 1024,
        maxHeight: 1024,
        supportsAlchemy: true,
        defaultPresetStyle: 'CREATIVE'
      },
      'leonardo-kino-xl': {
        id: 'aa77f04e-3eec-4034-9c07-d0f619684628', // Kino XL model ID
        name: 'Leonardo Kino XL',
        maxWidth: 1024,
        maxHeight: 1024,
        supportsAlchemy: true,
        defaultPresetStyle: 'CINEMATIC'
      },
      'dreamshaper-v7': {
        id: 'ac614f96-1082-45bf-be9d-757f2d31c174', // DreamShaper v7 model ID
        name: 'DreamShaper v7',
        maxWidth: 1024,
        maxHeight: 1024,
        supportsAlchemy: false,
        defaultPresetStyle: 'NONE'
      }
    };
    
    // Optimized style templates for high-converting video content
    this.styleTemplates = {
      'minimalist': 'ULTRA-CLEAN design with maximum contrast, single focal point, no decorative elements, edge-to-edge canvas usage, optimized for mobile clarity and engagement',
      'realistic': 'clean photorealistic style with high contrast, simple composition, clear focal point, full canvas usage, mobile-optimized visibility and click-through appeal',
      'illustration': 'simple vector illustration with bold contrast, minimal elements, clean composition, full canvas coverage, optimized for thumbnail clarity and engagement',
      'corporate': 'clean professional design with maximum readability, single authoritative element, high contrast, full canvas usage, mobile-first optimization',
      'vibrant': 'high-impact design with strategic color contrast, single bold element, full canvas usage edge-to-edge, maximum contrast, mobile-optimized for click-through rate',
      'tech': 'clean technology aesthetic with high contrast, minimal elements, full canvas usage edge-to-edge, mobile-friendly clarity and professional appeal',
      'educational': 'clear instructional design with maximum readability contrast, simple visual hierarchy, full canvas usage edge-to-edge, mobile engagement optimization'
    };
  }

  /**
   * Analyze script context for enhanced regeneration
   * @param {string} originalScript - Original script content
   * @param {object} videoMetadata - Video metadata
   * @returns {Promise<object>} Context analysis
   */
  async analyzeScriptContext(originalScript, videoMetadata) {
    try {
      const prompt = `
Analyze the following script to extract key contextual elements for enhanced regeneration:

Original Script:
${originalScript}

Video Metadata:
- Title: ${videoMetadata.title}
- Description: ${videoMetadata.description?.substring(0, 300)}

Perform a comprehensive CONTEXT ANALYSIS and return a JSON object with:

{
  "originalScriptIntent": "Core purpose and goal of the original content",
  "targetAudience": "Specific audience demographic and characteristics",
  "contentVibe": "Tone, style, and emotional approach (formal/casual/inspirational/etc)",
  "coreMessage": "Main takeaway or key insight",
  "hookStyle": "How the content captures attention (question/story/statistic/etc)",
  "callToActionApproach": "Style of CTA used (direct/soft/educational/etc)",
  "contentPillars": ["key theme 1", "key theme 2", "key theme 3"],
  "audienceSpecificLanguage": "Language style and terminology used",
  "videoFormat": "Content format (tutorial/story/tips/analysis/etc)"
}

Focus on preserving the essence while enabling development and enhancement.`;

      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      let responseText = completion.content[0].text.trim();
      
      // Clean JSON response
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }

      const contextAnalysis = JSON.parse(responseText);
      logger.info('Script context analyzed with Claude Sonnet');
      
      return contextAnalysis;
    } catch (error) {
      logger.error('Error analyzing script context:', error);
      // Return fallback context
      return {
        originalScriptIntent: 'Engage and inform audience',
        targetAudience: 'General viewers',
        contentVibe: 'Conversational and engaging',
        coreMessage: 'Value-driven content',
        hookStyle: 'Direct approach',
        callToActionApproach: 'Educational',
        contentPillars: ['information', 'engagement', 'value'],
        audienceSpecificLanguage: 'Clear and accessible',
        videoFormat: 'Educational content'
      };
    }
  }

  async generateAttractiveScript(originalTranscript, videoMetadata, contextAnalysis = null, keywordData = null) {
    try {
      // Perform context analysis if not provided (for regeneration scenarios)
      let context = contextAnalysis;
      if (!context) {
        context = await this.analyzeScriptContext(originalTranscript, videoMetadata);
      }

      const prompt = `
You are a viral YouTube content strategist and scriptwriter with expertise in algorithm optimization and audience psychology. Transform the original video into breakthrough content that maximizes engagement and viral potential.

CONTEXT ANALYSIS:
- Original Script Intent: ${context.originalScriptIntent}
- Target Audience: ${context.targetAudience}
- Content Vibe: ${context.contentVibe}
- Core Message: ${context.coreMessage}
- Hook Style: ${context.hookStyle}
- Call-to-Action Approach: ${context.callToActionApproach}
- Content Pillars: ${context.contentPillars.join(', ')}
- Audience Language: ${context.audienceSpecificLanguage}
- Video Format: ${context.videoFormat}

Original Video Information:
- Title: ${videoMetadata.title}
- Description: ${videoMetadata.description?.substring(0, 500)}

Original Transcript (Use as inspiration only):
${originalTranscript}

${keywordData ? `
SEO KEYWORD INTEGRATION STRATEGY:
- Primary Keywords (integrate 2-3 naturally): ${keywordData.primaryKeywords?.join(', ') || 'N/A'}
- Long-tail Keywords (address problems): ${keywordData.longTailKeywords?.slice(0, 5).join(', ') || 'N/A'}
- Question Keywords (answer directly): ${keywordData.questionKeywords?.slice(0, 3).join(', ') || 'N/A'}
- Semantic Keywords (natural mentions): ${keywordData.semanticKeywords?.slice(0, 4).join(', ') || 'N/A'}

SEO OPTIMIZATION REQUIREMENTS:
✅ Integrate primary keywords naturally throughout script (2-3% density)
✅ Address long-tail keyword problems within narrative structure
✅ Answer question keywords directly for voice search optimization
✅ Include semantic terms for comprehensive topical coverage
✅ Balance SEO integration with viral psychological triggers
✅ Ensure keywords flow naturally without compromising engagement
` : ''}

VIRAL CONTENT TRANSFORMATION FRAMEWORK:

🎯 ADVANCED HOOK ARCHITECTURE (First 3-5 seconds - CRITICAL for algorithm):
- Multi-Layered Pattern Interrupt: Break expectations + create curiosity + establish stakes
- Nested Curiosity Gaps: "The thing everyone gets wrong about X that even experts miss..."
- Authority Challenge Hooks: "I've been doing X for 10 years, but this changed everything..."
- Identity Disruption: "If you think you're a [identity], this will shock you..."
- Future Pacing with Specificity: "30 days from now, you'll thank yourself for the next 3 minutes..."
- Embedded Commands: "As you watch this, you'll discover..." / "Notice how this changes..."

📈 ADVANCED ALGORITHM OPTIMIZATION STRATEGIES:
- Multi-Point Retention Engineering: Hooks at 5s, 15s, 30s, 60s, 2min marks
- Advanced Comment Bait: Strategic controversial statements + opinion triggers
- Rewatch Architecture: Dense information layers + callback references
- Session Extension: "What to watch next" integration + series connectivity
- Share Psychology: "You need to see this" moments + social validation triggers
- Engagement Signal Timing: Specific pause points and interaction prompts

🧠 ADVANCED PSYCHOLOGICAL ENGAGEMENT TRIGGERS:
- Layered Social Proof: Peer validation + expert authority + community belonging
- Cognitive Scarcity: Information exclusivity + time sensitivity + opportunity cost
- Multi-Dimensional Authority: Experience + data + results + testimonials
- Strategic Reciprocity: Value-first approach + exclusive insights + actionable takeaways
- Identity Alignment: "People like you who..." + aspirational identity + transformation
- Advanced FOMO: Consequences of inaction + competitive disadvantage + missed opportunities
- Pre-Suasion Priming: Environmental setup + cognitive ease + receptive state creation

📊 ADVANCED NARRATIVE STRUCTURE FOR MAXIMUM RETENTION:

HERO'S JOURNEY INTEGRATION:
- Ordinary World Hook (0-10s): Current state + pattern interrupt + curiosity gap
- Call to Adventure (10-20s): Challenge presentation + pain amplification + stakes
- Refusal/Hesitation (20-30s): Common objections + fear addressing + hope injection
- Mentor Introduction (30-45s): Authority establishment + social proof + trust building
- Crossing Threshold (45s-1:30m): Action commitment + method introduction + value delivery
- Trials & Solutions (1:30-2m): Obstacles + breakthrough moments + transformation evidence
- Return with Elixir (2-2:30m): Results demonstration + social validation + success proof
- Master CTA (2:30-3m): Multi-layered conversion + session extension + community invitation

RETENTION CHECKPOINTS:
- 5s: Micro-hook + emotional trigger
- 15s: Value confirmation + algorithm signal
- 30s: First "aha moment" + engagement prompt
- 60s: Major transformation tease + retention hook
- 2m: Evidence/proof + social validation

🚀 ADVANCED VIRALITY MULTIPLIERS:
- Quotable Moments: Memorable one-liners + screenshot-worthy insights + social media gold
- Strategic Controversy: Safe polarizing statements + opinion triggers + discussion catalysts  
- Value Density: Actionable takeaways + save-worthy content + tutorial elements
- Surprise Elements: Unexpected revelations + humor integration + pattern breaks
- Universal Connection: Shared experiences + emotional resonance + relatability factors
- Cognitive Ease + Effort: Familiar concepts explained simply + dense value layers
- Social Currency: Status-enhancing information + conversation starters + community building

🎭 ADVANCED LANGUAGE PATTERN OPTIMIZATION:

EMBEDDED COMMAND STRUCTURES:
- "As you continue watching, you'll discover..."
- "The more you think about this, the clearer it becomes..."
- "Notice how this changes your perspective on..."
- "You might find yourself wondering..."

POWER WORD HIERARCHIES:
- Tier 1 (Attention): "Breakthrough," "Revolutionary," "Forbidden," "Secret," "Exclusive"
- Tier 2 (Urgency): "Before it's too late," "Limited time," "Disappearing," "Final chance"
- Tier 3 (Authority): "Proven," "Research shows," "Experts agree," "Studies reveal," "Data confirms"
- Tier 4 (Transformation): "Transform," "Breakthrough," "Unlock," "Discover," "Master"

COGNITIVE LOAD MANAGEMENT:
- Information Chunking: Break complex concepts into 3-4 digestible pieces
- Progressive Disclosure: Layer complexity gradually throughout narrative
- Mental Models: Create clear frameworks using familiar-to-unfamiliar progression
- Elaborative Encoding: Connect new information to existing viewer knowledge

EMOTIONAL PROGRESSION MAPPING:
Curiosity → Concern → Hope → Excitement → Determination → Satisfaction → Action
Each transition requires specific trigger words and narrative bridges.

CREATIVE TRANSFORMATION REQUIREMENTS:
✅ Preserve core audience and value proposition while amplifying engagement
✅ Create completely new stories, examples, and analogies with emotional resonance
✅ Build Hero's Journey narrative structure with retention checkpoints
✅ Design multi-layered hooks with embedded commands and authority positioning
✅ Craft advanced language patterns using psychological triggers and NLP techniques
✅ Include strategic comment-baiting and discussion catalyst elements
✅ Structure for maximum algorithm performance with retention engineering
✅ Integrate social currency and shareable moments throughout narrative

ENHANCED PERFORMANCE TARGETS:
- 95%+ retention at 15 seconds (algorithm boost threshold)
- 15%+ click-through rate potential (viral threshold)
- 3%+ comment rate in first hour (engagement signal strength)
- 8%+ share probability through social currency integration
- Strong session duration with next-video connectivity
- Average watch time >75% for algorithm preference
- Subscriber conversion rate >2% for growth optimization

MASTER SCRIPT CREATION DIRECTIVE:

Create a breakthrough script using the ADVANCED FRAMEWORK above that serves the same audience but has 10x higher viral potential. Your script must demonstrate:

🎯 HOOK MASTERY: Multi-layered opening with pattern interrupt + curiosity gap + embedded command
📚 NARRATIVE ARCHITECTURE: Hero's Journey structure with retention checkpoints every 15 seconds  
🧠 PSYCHOLOGICAL DEPTH: Advanced triggers including pre-suasion, social proof layering, identity alignment
🎭 LINGUISTIC EXCELLENCE: Power word hierarchies, embedded commands, emotional progression mapping
📈 ALGORITHM OPTIMIZATION: Specific retention engineering with comment bait and share triggers
🚀 VIRAL MULTIPLICATION: Social currency, quotable moments, discussion catalysts integrated naturally

CRITICAL SUCCESS FACTORS:
- Each sentence must serve a specific psychological or algorithmic purpose
- Include specific retention hooks at 5s, 15s, 30s, 60s, and 2m marks
- Embed natural comment-baiting questions and controversial (but safe) statements
- Create at least 3 shareable/quotable moments throughout the narrative
- Build emotional progression from curiosity to action with smooth transitions
- Integrate authority establishment, social proof, and identity alignment seamlessly
- End with multi-layered CTA including next action, community invitation, and session extension

Return only the breakthrough script - no commentary, explanations, or meta-information.`;

      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const generatedScript = completion.content[0].text.trim();
      logger.info('Script generated with Claude Sonnet');
      
      return generatedScript;
    } catch (error) {
      logger.error('Error generating attractive script with Claude:', error);
      logger.info('Falling back to OpenAI GPT-4o-mini');
      
      // Fallback to OpenAI
      try {
        const fallbackPrompt = `
You are an advanced YouTube scriptwriter and viral content strategist specializing in algorithm optimization and audience psychology. Transform the original content into a breakthrough script with superior engagement potential.

Original Video Information:
- Title: ${videoMetadata.title}
- Description: ${videoMetadata.description?.substring(0, 500)}

Original Transcript (Use as inspiration only):
${originalTranscript}

${keywordData ? `
SEO KEYWORD INTEGRATION STRATEGY:
- Primary Keywords (integrate 2-3 naturally): ${keywordData.primaryKeywords?.join(', ') || 'N/A'}
- Long-tail Keywords (address problems): ${keywordData.longTailKeywords?.slice(0, 5).join(', ') || 'N/A'}
- Question Keywords (answer directly): ${keywordData.questionKeywords?.slice(0, 3).join(', ') || 'N/A'}
- Semantic Keywords (natural mentions): ${keywordData.semanticKeywords?.slice(0, 4).join(', ') || 'N/A'}

IMPORTANT: Integrate these keywords naturally throughout the script while maintaining engagement.
` : ''}

ADVANCED SCRIPT ARCHITECTURE:

🎯 HOOK REQUIREMENTS (0-10s):
- Pattern interrupt that breaks viewer expectations immediately
- Multi-layered curiosity gap: "The thing about X that even experts miss..."
- Authority challenge: "I've been doing this for years, but this changed everything..."
- Future pacing: "By the end of this video, you'll..."

📚 NARRATIVE STRUCTURE (Hero's Journey Integration):
- Current State Problem (0-15s): Identify with viewer's frustration
- Challenge Introduction (15-30s): Present the obstacle or opportunity
- Authority & Social Proof (30-45s): Establish credibility with evidence
- Method/Solution (45s-1:30m): Deliver core value with actionable insights
- Transformation Evidence (1:30-2m): Show results and proof
- Strong CTA (2-2:30m): Multiple action steps and community invitation

🧠 PSYCHOLOGICAL OPTIMIZATION:
- Embed social proof throughout (not just one section)
- Use identity language: "People who are serious about X..."
- Create cognitive ease with familiar-to-unfamiliar progression
- Include strategic controversy: safe polarizing statements for discussion
- Build emotional progression: Curiosity → Hope → Excitement → Action

📈 ALGORITHM SIGNALS:
- Retention hooks at 15s, 30s, 60s marks
- Comment-baiting questions integrated naturally
- Rewatchability through dense information layers
- Share triggers: quotable moments and social currency
- Session extension setup for next videos

🎭 LANGUAGE PATTERNS:
- Power words: "Breakthrough," "Secret," "Proven," "Exclusive"
- Embedded commands: "As you watch this, notice how..."
- Progressive disclosure of complexity
- Emotional trigger words aligned with transformation

Create a breakthrough script that demonstrates these advanced techniques while serving the same audience. Focus on maximum engagement, retention, and viral potential. Return only the script without commentary.`;

        const fallbackCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert YouTube scriptwriter specializing in creating engaging short-form content.'
            },
            {
              role: 'user',
              content: fallbackPrompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.7
        });

        const generatedScript = fallbackCompletion.choices[0].message.content.trim();
        logger.info('Script generated with OpenAI fallback');
        
        return generatedScript;
      } catch (fallbackError) {
        logger.error('Both Claude and OpenAI failed for script generation:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async generateOptimizedDescription(script, originalMetadata, keywords = []) {
    try {
      // Organize keywords by priority and type
      const primaryKeywords = keywords.slice(0, 4);
      const secondaryKeywords = keywords.slice(4, 8);
      const hashtagKeywords = keywords.slice(0, 6);
      
      const prompt = `
Create a completely NEW and original YouTube video description optimized for SEO and engagement based on this enhanced script content:

Enhanced Script Content:
${script}

SEO KEYWORD STRATEGY:
Primary Keywords (must include naturally): ${primaryKeywords.join(', ')}
Secondary Keywords (sprinkle throughout): ${secondaryKeywords.join(', ')}
Hashtag Keywords: ${hashtagKeywords.join(', ')}
All Keywords Available: ${keywords.join(', ')}

ADVANCED SEO DESCRIPTION REQUIREMENTS:

1. HOOK SECTION (First 125 characters):
   - Include primary keyword within first sentence
   - Create compelling hook that encourages "Show More" clicks
   - Front-load most important information

2. VALUE PROPOSITION (Characters 125-400):
   - Clearly explain what viewer will learn/gain
   - Include 2-3 primary keywords naturally
   - Address viewer pain points or desires
   - Use benefit-driven language

3. CONTENT OUTLINE (Characters 400-700):
   - Brief breakdown of key points covered
   - Include secondary keywords contextually
   - Use bullet points or numbered list for scannability
   - Mention specific takeaways or results

4. ENGAGEMENT & SEO SECTION (Characters 700-900):
   - Strong call-to-action for likes, comments, subscribes
   - Ask engaging question to drive comments
   - Include keyword variations and semantic terms
   - Add social proof elements if applicable

5. HASHTAG OPTIMIZATION (Final section):
   - 8-12 strategic hashtags mixing trending and niche terms
   - Include branded hashtags if applicable
   - Balance broad (#productivity) with specific (#workfromhomeproductivity)
   - Use mix of keyword-based and topical hashtags

SEO OPTIMIZATION REQUIREMENTS:
✅ Keyword density: 2-3% for primary keywords (natural integration)
✅ Semantic keywords: Include related terms and synonyms
✅ Question integration: Include 1-2 questions with target keywords
✅ User intent alignment: Match description to search intent
✅ Featured snippet optimization: Structure for potential snippet capture
✅ Call-to-action with keywords: "Learn more about [keyword]"
✅ Accessibility: Clear structure, easy to scan
✅ Mobile optimization: Front-load important information

CONTENT STRATEGY:
- Write as if this is completely original content for a new channel
- Focus on unique value proposition and fresh insights
- Use conversational, engaging tone that builds connection
- Include urgency or scarcity elements where appropriate
- Emphasize transformation or results viewer will achieve

Return the complete SEO-optimized description ready for YouTube upload.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube SEO expert specializing in creating optimized video descriptions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.6
      });

      const optimizedDescription = completion.choices[0].message.content.trim();
      logger.info('Description generated');
      
      return optimizedDescription;
    } catch (error) {
      logger.error('Error generating optimized description:', error);
      throw error;
    }
  }

  async generateOptimizedTitle(script, originalTitle, keywords = []) {
    try {
      // Separate keywords by type for better targeting
      const primaryKeywords = keywords.slice(0, 3); // Most important keywords
      const longTailKeywords = keywords.slice(3, 6); // More specific terms
      
      const prompt = `
You are a viral YouTube title optimization expert with proven track record of 15%+ CTR titles. Create 5 high-converting titles based SPECIFICALLY on this new generated script content with advanced SEO keyword integration.

SCRIPT ANALYSIS:
Original Reference Title: ${originalTitle}
NEW GENERATED SCRIPT CONTENT: ${script.substring(0, 800)}...

KEYWORD STRATEGY:
Primary Keywords (must include 1-2): ${primaryKeywords.join(', ')}
Long-tail Keywords (natural integration): ${longTailKeywords.join(', ')}
All Available Keywords: ${keywords.join(', ')}

VIRAL TITLE FRAMEWORK:

🎯 PSYCHOLOGICAL TRIGGERS (Use 2-3 per title):
- Curiosity Gap: "The [X] Nobody Talks About"
- Social Proof: "Everyone's Doing [X] Wrong"
- Urgency/Scarcity: "Before It's Too Late"
- Authority: "Experts Don't Want You to Know"
- Personal Stakes: "This Will Change Your [X]"
- Pattern Interrupt: "Stop [Common Action]"
- Results Preview: "How I [Achievement] in [Timeframe]"
- Controversy: "Unpopular Opinion About [X]"

📊 CTR OPTIMIZATION STRATEGIES:
- Emotional Power Words: "Shocking", "Secret", "Mistake", "Warning", "Reveal"
- Numbers & Specificity: Exact timeframes, percentages, quantities
- Questions That Demand Answers: "Why Does [X] Always [Y]?"
- Before/After Implications: "From [Bad State] to [Good State]"
- Exclusive Information: "Inside Look", "Behind Scenes", "Never Told"

🧠 ALGORITHM & SEO OPTIMIZATION:
- Mobile-First: 50-60 characters for full mobile visibility
- Keyword Integration: Include 1-2 primary keywords naturally (not forced)
- Semantic Variations: Use related terms and synonyms
- Search Intent Alignment: Match title to user search intent
- Click-Through Magnets: Words that make scrolling impossible
- Avoid Clickbait: Promise exactly what the script delivers
- Thumbnail Synergy: Title complements visual elements

📈 PERFORMANCE TARGETING:
- 12%+ CTR potential (viral threshold)
- High relevance to script content
- Search discovery optimization
- Suggested video algorithm appeal
- Cross-demographic appeal when appropriate

TITLE CREATION RULES:
✅ Based 100% on NEW script content, not original video
✅ Promise value that script actually delivers
✅ Include psychological trigger from framework above
✅ Optimize for mobile viewing (character limits)
✅ Create irresistible curiosity or desire
✅ Target high-intent keywords from script
✅ Appeal to specific audience pain points/desires from content
✅ Avoid generic/overused phrases

ANALYZE THE SCRIPT FIRST:
- What's the core transformation/value?
- What specific problem does it solve?
- What's the unique angle or approach?
- What results/outcomes are promised?
- What emotions does it target?

Create 5 distinct title options optimized for maximum CTR based on the NEW script content. Each title should use different psychological triggers and approaches. Return as numbered list 1-5.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube optimization expert specializing in creating viral, clickable titles.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.8
      });

      const titleOptions = completion.choices[0].message.content.trim();
      
      // Enhanced parsing to extract only the actual titles
      const lines = titleOptions.split('\n');
      const titles = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines, intro text, and formatting
        if (!trimmed || 
            trimmed.toLowerCase().includes('here are') ||
            trimmed.toLowerCase().includes('optimized') ||
            trimmed.toLowerCase().includes('based on') ||
            trimmed.toLowerCase().includes('psychological triggers') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('(') ||
            trimmed.length < 10) {
          continue;
        }
        
        // Clean up the title - remove numbering, quotes, and extra formatting
        const cleanTitle = trimmed
          .replace(/^\d+\.\s*/, '') // Remove numbering
          .replace(/^\**"?/, '') // Remove leading stars and quotes
          .replace(/"?\**$/, '') // Remove trailing quotes and stars
          .replace(/\*\*/g, '') // Remove bold markdown
          .trim();
        
        // Only add if it looks like a proper title (not empty and reasonable length)
        if (cleanTitle && cleanTitle.length >= 10 && cleanTitle.length <= 200) {
          titles.push(cleanTitle);
        }
      }
      
      logger.info(`Extracted ${titles.length} clean titles from AI response`);
      
      return {
        options: titles.slice(0, 5), // Limit to 5 titles max
        recommended: titles[0] || 'Optimized Title'
      };
    } catch (error) {
      logger.error('Error generating optimized titles:', error);
      throw error;
    }
  }

  async performKeywordResearch(videoContent, _niche = '') {
    try {
      const prompt = `
Perform comprehensive SEO and YouTube algorithm-optimized keyword research for a YouTube video based on the following content:

Video Content: ${videoContent.substring(0, 1200)}
Niche Context: ${_niche || 'General Content'}

ADVANCED KEYWORD RESEARCH REQUIREMENTS:

Generate a comprehensive keyword strategy including:

1. PRIMARY KEYWORDS (8-12): High search volume, directly relevant, mixed competition levels
   - Focus on main topic and core concepts
   - Include both broad and specific terms
   - Consider search intent alignment

2. LONG-TAIL KEYWORDS (12-15): Specific phrases, lower competition, higher conversion potential
   - 3-6 word phrases with clear intent
   - Problem-solving focused terms
   - How-to and question-based variations

3. SEMANTIC KEYWORDS (8-10): LSI terms and related concepts
   - Synonyms and variations of primary terms
   - Contextually related words
   - Industry-specific terminology

4. QUESTION KEYWORDS (6-8): Voice search and featured snippet optimization
   - How, what, why, when, where questions
   - Natural language patterns
   - FAQ-style queries

5. TRENDING HASHTAGS (6-8): Current social trends and discoverability
   - Mix of evergreen and trending tags
   - Platform-specific trends
   - Niche community tags

6. COMPETITIVE KEYWORDS (5-7): Gap opportunities and alternatives
   - Underserved keyword opportunities
   - Alternative angles to popular terms
   - Emerging trend keywords

7. RELATED TOPICS (8-10): Content expansion and topical authority
   - Adjacent topics for future content
   - Subtopics within main theme
   - Cross-referenced subjects

8. YOUTUBE SEARCH KEYWORDS (6-8): Optimized specifically for YouTube search discovery
   - Keywords that perform well in YouTube search results
   - Video-focused search terms
   - Platform-specific user language

9. BROWSE FEED KEYWORDS (5-7): Optimized for YouTube's suggested/browse features
   - Keywords that trigger algorithm recommendations
   - Related video suggestions optimization
   - Cross-video discovery terms

10. SHORTS OPTIMIZED KEYWORDS (5-8): Specific for YouTube Shorts algorithm
    - #Shorts feed optimization terms
    - Vertical video format considerations
    - Mobile-first consumption patterns

11. ALGORITHM BOOST KEYWORDS (4-6): Keywords that trigger YouTube algorithm promotion
    - High engagement trigger words
    - Algorithm signal boosters
    - Performance optimization terms

12. RETENTION KEYWORDS (4-6): Keywords that improve watch time and session duration
    - Watch time extending terms
    - Binge-worthy content indicators
    - Session optimization phrases

13. ENGAGEMENT TRIGGER KEYWORDS (4-6): Keywords that drive comments, likes, and shares
    - Community engagement starters
    - Discussion trigger phrases
    - Social interaction boosters

KEYWORD SELECTION CRITERIA:
✅ Search intent alignment (informational, transactional, navigational)
✅ YouTube-specific optimization (video-focused terms)
✅ Algorithm performance consideration (CTR, retention, engagement)
✅ Audience language and terminology
✅ Semantic relevance and context
✅ Competition level diversity (high, medium, low)
✅ Commercial viability where applicable
✅ Mobile-first optimization
✅ Cross-platform discoverability

Format the response as JSON with the following structure:
{
  "primaryKeywords": [],
  "longTailKeywords": [],
  "semanticKeywords": [],
  "questionKeywords": [],
  "trendingHashtags": [],
  "competitiveKeywords": [],
  "relatedTopics": [],
  "youtubeSearchKeywords": [],
  "browseFeedKeywords": [],
  "shortsOptimizedKeywords": [],
  "algorithmBoostKeywords": [],
  "retentionKeywords": [],
  "engagementTriggerKeywords": []
}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a YouTube SEO and keyword research specialist with deep expertise in YouTube algorithm optimization, content discovery, and viewer engagement strategies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.5
      });

      let responseText = completion.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const keywordData = JSON.parse(responseText);
      logger.info('Keywords researched');
      
      return keywordData;
    } catch (error) {
      logger.error('Error performing keyword research:', error);
      return {
        primaryKeywords: [],
        longTailKeywords: [],
        semanticKeywords: [],
        questionKeywords: [],
        trendingHashtags: [],
        competitiveKeywords: [],
        relatedTopics: [],
        youtubeSearchKeywords: [],
        browseFeedKeywords: [],
        shortsOptimizedKeywords: [],
        algorithmBoostKeywords: [],
        retentionKeywords: [],
        engagementTriggerKeywords: []
      };
    }
  }

  async breakdownScriptIntoSentences(script) {
    try {
      const prompt = `
Break down the following script into individual sentences that are suitable for creating images/visuals. Each sentence should:
1. Be complete and make sense on its own
2. Be suitable for visual representation
3. Be concise but meaningful
4. Flow naturally when combined

Script:
${script}

Return the sentences as a JSON array of strings, like this:
["sentence 1", "sentence 2", "sentence 3", ...]`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at breaking down video scripts into visually-suitable segments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      let responseText = completion.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const sentences = JSON.parse(responseText);
      logger.info(`Script: ${sentences.length} sentences`);
      
      return sentences;
    } catch (error) {
      logger.error('Error breaking down script:', error);
      throw error;
    }
  }

  /**
   * Select a consistent visual style for the entire video
   * @param {string} script - Video script content
   * @param {object} metadata - Video metadata
   * @returns {Promise<{style: string, template: string, description: string}>}
   */
  async selectVideoStyle(script, metadata) {
    try {
      const prompt = `
Analyze the following video content and select the most appropriate visual style:

Title: ${metadata.title}
Script Preview: ${script.substring(0, 500)}...

Available styles:
1. minimalist - Clean, simple, modern
2. realistic - Photorealistic, professional  
3. illustration - Hand-drawn, artistic
4. corporate - Professional, business-oriented
5. vibrant - Colorful, energetic
6. tech - Modern, digital, futuristic
7. educational - Clear, informative diagrams
8. beyondbeing - Inspiring motivational aesthetic with uplifting colors and professional composition

For self-development, motivational, personal growth, or inspirational content, prioritize "beyondbeing" style.

Return only the style name (one word) that best matches this content.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a visual design expert specializing in selecting appropriate styles for video content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 20,
        temperature: 0.3
      });

      const selectedStyle = completion.choices[0].message.content.trim().toLowerCase();
      const validStyle = this.styleTemplates[selectedStyle] ? selectedStyle : 'beyondbeing';
      
      logger.info(`Style: ${validStyle}`);
      
      return {
        style: validStyle,
        template: this.styleTemplates[validStyle],
        description: `Consistent ${validStyle} style throughout the video`
      };
    } catch (error) {
      logger.error('Error selecting video style:', error);
      // Default fallback to professional style for better visual appeal
      return {
        style: 'professional',
        template: this.styleTemplates.professional || this.styleTemplates.beyondbeing,
        description: 'Default professional inspirational style'
      };
    }
  }

  async generateImagePrompts(scriptSentences, videoStyle = null, metadata = {}) {
    try {
      // Select consistent style for the entire video if not provided
      let styleInfo = videoStyle;
      if (!styleInfo || typeof styleInfo === 'string') {
        const script = scriptSentences.join(' ');
        styleInfo = await this.selectVideoStyle(script, metadata);
      }
      
      const prompts = [];
      const baseStylePrompt = styleInfo.template;
      
      for (const sentence of scriptSentences) {
        const promptText = `
Create a premium DALL-E image prompt for the following script sentence, designed as standalone professional visual content:

Sentence: "${sentence}"

BASE STYLE (MUST BE MAINTAINED):
${baseStylePrompt}

PROFESSIONAL ENHANCEMENT REQUIREMENTS:
1. VISUAL EXCELLENCE: Create cinematically composed, premium quality imagery with professional lighting setup
2. STYLE CONSISTENCY: MUST maintain the exact same ${styleInfo.style} aesthetic as all other images in this video
3. VISUAL COMPOSITION: Create compelling standalone artwork with professional composition and visual storytelling
4. PREMIUM COMPOSITION: Apply rule of thirds, leading lines, depth of field, and professional framing techniques
5. LIGHTING MASTERY: Implement studio-quality lighting with rim lighting, fill light, key light setup for dimensional depth
6. COLOR SOPHISTICATION: Use carefully curated color palettes with complementary and analogous color schemes
7. TEXTURAL RICHNESS: Include premium textures, materials, and surface details for high-end visual appeal
8. SYMBOLIC DEPTH: Integrate meaningful visual metaphors and symbols that reinforce the content message
9. TYPOGRAPHY SPACE: Ensure clean, uncluttered areas suitable for professional text overlay placement
10. ENGAGEMENT OPTIMIZATION: Design for maximum social media engagement and click-through rates

ADVANCED VISUAL SPECIFICATIONS:
- Professional studio lighting with soft shadows and dramatic highlights
- Rich, saturated color palette with strategic contrast for visual impact
- Premium materials and textures (brushed metal, soft fabrics, polished surfaces)
- Dynamic camera angles with intentional perspective and depth
- Symbolic elements that enhance storytelling and message delivery
- High-resolution clarity with sharp focus and professional polish
- Modern, contemporary aesthetic that feels current and inspiring
- Sophisticated gradients and subtle pattern integration
- Clean negative space for text overlay functionality
- Emotional resonance through color psychology and visual psychology

CRITICAL: Begin your prompt with "${baseStylePrompt}, " followed by these enhanced specifications to ensure perfect consistency.

Generate only the complete, professional-grade image prompt.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating detailed, consistent prompts for AI image generation. Always maintain the exact same visual style throughout a video series.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          max_tokens: 200,
          temperature: 0.6
        });

        const fullPrompt = completion.choices[0].message.content.trim();
        prompts.push({
          prompt: fullPrompt,
          sentence: sentence,
          style: styleInfo.style
        });
      }

      logger.info(`Generated ${prompts.length} prompts`);
      return {
        prompts,
        videoStyle: styleInfo
      };
    } catch (error) {
      logger.error('Error generating image prompts:', error);
      throw error;
    }
  }

  async generateEditorKeywords(scriptSentences) {
    try {
      const editorKeywords = [];
      
      for (const sentence of scriptSentences) {
        const promptText = `
Extract 3-6 key words or phrases that ACTUALLY APPEAR in the following script sentence. These keywords will help video editors find relevant B-roll footage.

Script Sentence: "${sentence}"

Requirements:
1. ONLY extract words/phrases that exist in the sentence - do not create new keywords
2. Focus on important nouns, action verbs, and visual elements that appear in the text
3. Highlight words that would help find stock footage or B-roll
4. Include the most visually significant words from the sentence
5. Separate with commas
6. Use the exact words as they appear in the sentence (maintain capitalization if meaningful)

Examples:
- For "The market crashed in 2008 causing widespread panic": market, crashed, 2008, widespread panic
- For "She walked through the forest path": walked, forest, path
- For "Technology is changing our daily lives rapidly": Technology, changing, daily lives, rapidly

Return only the comma-separated keywords that exist in the sentence, nothing else.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting key words and phrases that actually appear in text for video editing purposes. Only highlight words that exist in the original sentence.'
            },
            {
              role: 'user',
              content: promptText
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });

        const keywords = completion.choices[0].message.content.trim();
        editorKeywords.push(keywords);
      }

      logger.info(`Keywords: ${editorKeywords.length} sentences`);
      return editorKeywords;
    } catch (error) {
      logger.error('Error generating editor keywords:', error);
      throw error;
    }
  }

  /**
   * Calculate cost for image generation
   * @param {string} model - Image generation model
   * @param {number} count - Number of images
   * @returns {number} Cost in USD
   */
  calculateImageCost(model = config.app.imageModel, count = 1) {
    const costPerImage = this.pricing[model] || this.pricing['dall-e-2'];
    return costPerImage * count;
  }

  /**
   * Track costs for a video
   * @param {string} videoId - Video identifier
   * @param {number} cost - Cost to add
   * @param {string} type - Type of cost (image, processing, etc.)
   */
  trackVideoCost(videoId, cost, type = 'image') {
    if (!this.costTracker.videoCosts.has(videoId)) {
      this.costTracker.videoCosts.set(videoId, { total: 0, breakdown: {} });
    }
    
    const videoCost = this.costTracker.videoCosts.get(videoId);
    videoCost.total += cost;
    videoCost.breakdown[type] = (videoCost.breakdown[type] || 0) + cost;
    
    this.costTracker.totalCost += cost;
    
    logger.info(`Video ${videoId} cost: $${videoCost.total.toFixed(4)} (+$${cost.toFixed(4)} ${type})`);
  }

  /**
   * Check if video is within budget
   * @param {string} videoId - Video identifier
   * @param {number} additionalCost - Additional cost to check
   * @returns {boolean} Whether the cost is within budget
   */
  isWithinBudget(videoId, additionalCost = 0) {
    const currentCost = this.costTracker.videoCosts.has(videoId) ? 
      this.costTracker.videoCosts.get(videoId).total : 0;
    const totalCost = currentCost + additionalCost;
    
    return totalCost <= config.app.maxImageCostPerVideo;
  }

  /**
   * Generate image using Leonardo AI API
   * @param {string} prompt - Image generation prompt
   * @param {object} options - Generation options
   * @returns {Promise<object>} Leonardo AI response with image URL
   */
  async generateLeonardoImage(prompt, options = {}) {
    try {
      const { 
        model = config.leonardo.defaultModel,
        width = config.app.imageWidth,
        height = config.app.imageHeight,
        numImages = 1,
        enableAlchemy = config.leonardo.enableAlchemy,
        presetStyle = null
      } = options;

      // Get model configuration
      const modelConfig = this.leonardoModels[model];
      if (!modelConfig) {
        throw new Error(`Unsupported Leonardo AI model: ${model}`);
      }

      // Adjust dimensions to model limits and ensure divisible by 8
      let finalWidth = Math.min(width, modelConfig.maxWidth);
      let finalHeight = Math.min(height, modelConfig.maxHeight);
      
      // Ensure dimensions are divisible by 8 and within range [32, 1024]
      finalWidth = Math.max(32, Math.min(1024, Math.floor(finalWidth / 8) * 8));
      finalHeight = Math.max(32, Math.min(1024, Math.floor(finalHeight / 8) * 8));

      // Build request body
      const requestBody = {
        modelId: modelConfig.id,
        prompt: prompt,
        width: finalWidth,
        height: finalHeight,
        num_images: numImages,
        guidance_scale: 7, // Leonardo recommended default
        contrastRatio: enableAlchemy ? 2.5 : undefined, // Required for alchemy
        alchemy: enableAlchemy && modelConfig.supportsAlchemy,
        enhancePrompt: false // We handle prompt enhancement with GPT-4o
      };

      // Add preset style if supported
      if (presetStyle || modelConfig.defaultPresetStyle !== 'NONE') {
        requestBody.presetStyle = presetStyle || modelConfig.defaultPresetStyle;
      }

      logger.info(`Generating Leonardo AI image: ${model} (${finalWidth}x${finalHeight})`);
      
      // Create generation
      const createResponse = await this.leonardoClient.post('/generations', requestBody);
      const generationId = createResponse.data.sdGenerationJob.generationId;
      
      logger.info(`Leonardo AI generation started: ${generationId}`);

      // Poll for completion
      const imageUrl = await this.pollLeonardoGeneration(generationId);
      
      return {
        url: imageUrl,
        generationId,
        model: modelConfig.name,
        modelId: modelConfig.id,
        dimensions: `${finalWidth}x${finalHeight}`,
        alchemy: requestBody.alchemy,
        presetStyle: requestBody.presetStyle
      };
    } catch (error) {
      logger.error('Error generating Leonardo AI image:', error);
      if (error.response) {
        logger.error('Leonardo API response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Poll Leonardo AI generation until completion
   * @param {string} generationId - Generation ID to poll
   * @returns {Promise<string>} Image URL when complete
   */
  async pollLeonardoGeneration(generationId, maxAttempts = 30, pollInterval = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.leonardoClient.get(`/generations/${generationId}`);
        const generation = response.data.generations_by_pk;
        
        if (generation.status === 'COMPLETE' && generation.generated_images?.length > 0) {
          const imageUrl = generation.generated_images[0].url;
          logger.info(`Leonardo AI generation completed: ${generationId}`);
          return imageUrl;
        } else if (generation.status === 'FAILED') {
          throw new Error(`Leonardo AI generation failed: ${generationId}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        logger.debug(`Polling Leonardo AI generation ${generationId} (attempt ${attempt + 1}/${maxAttempts})`);
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw new Error(`Leonardo AI polling timeout for generation ${generationId}: ${error.message}`);
        }
        logger.warn(`Poll attempt ${attempt + 1} failed:`, error.message);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error(`Leonardo AI generation timeout after ${maxAttempts} attempts`);
  }

  async generateImage(prompt, options = {}) {
    try {
      // Default options for YouTube video format
      const defaultOptions = {
        size: `${config.app.imageWidth}x${config.app.imageHeight}`, // 1920x1080 for YouTube
        model: config.app.imageModel, // Use configured model
        provider: config.app.imageProvider, // leonardo or openai
        quality: 'standard',
        videoId: null,
        enhanceWithClaudeSonnet: config.app.enhancePromptsWithClaudeSonnet !== 'false' // Default true for Leonardo AI optimization
      };
      
      const finalOptions = { ...defaultOptions, ...options };
      
      // Enhance prompt with Claude Sonnet for Leonardo AI optimization (much cheaper!)
      let enhancedPrompt = prompt;
      if (finalOptions.enhanceWithClaudeSonnet && (finalOptions.videoId || options.isThumbnail)) {
        try {
          logger.info('🧠 Enhancing prompt with Claude Sonnet for Leonardo AI optimization...');
          enhancedPrompt = await this.enhancePromptWithClaudeSonnet(prompt, {
            ...options,
            model: finalOptions.model,
            size: finalOptions.size
          });
          logger.info('✨ Claude Sonnet enhanced prompt successfully');
        } catch (enhanceError) {
          logger.warn('Claude Sonnet prompt enhancement failed, using original:', enhanceError.message);
          enhancedPrompt = prompt; // Fallback to original prompt
        }
      }
      
      // Check budget if video ID provided (including Claude Sonnet costs - much cheaper!)
      if (finalOptions.videoId) {
        const imageModelCost = this.calculateImageCost(finalOptions.model, 1);
        const claudeCost = finalOptions.enhanceWithClaudeSonnet ? 0.0015 : 0; // Claude Sonnet: $0.0015 (85% cheaper!)
        const estimatedCost = imageModelCost + claudeCost;
        
        if (!this.isWithinBudget(finalOptions.videoId, estimatedCost)) {
          const currentCost = this.costTracker.videoCosts.get(finalOptions.videoId)?.total || 0;
          logger.warn(`Image generation would exceed budget. Current: $${currentCost.toFixed(4)}, Max: $${config.app.maxImageCostPerVideo}`);
          throw new Error(`Budget exceeded: Current cost $${currentCost.toFixed(4)}, additional $${estimatedCost.toFixed(4)} would exceed max $${config.app.maxImageCostPerVideo}`);
        }
      }

      // Generate image based on provider
      let response;
      let actualCost = 0;
      let imageUrl;
      let revisedPrompt = enhancedPrompt;
      
      // Determine provider from model name or explicit provider option
      const isLeonardoModel = finalOptions.model.startsWith('leonardo-') || finalOptions.model.startsWith('dreamshaper-');
      const shouldUseLeonardo = finalOptions.provider === 'leonardo' || isLeonardoModel;
      
      if (shouldUseLeonardo) {
        // Use Leonardo AI
        logger.info(`Using Leonardo AI for image generation: ${finalOptions.model}`);
        
        const [width, height] = finalOptions.size.split('x').map(Number);
        const leonardoResponse = await this.generateLeonardoImage(enhancedPrompt, {
          model: finalOptions.model,
          width,
          height,
          numImages: 1,
          enableAlchemy: config.leonardo.enableAlchemy
        });
        
        imageUrl = leonardoResponse.url;
        actualCost = this.calculateImageCost(finalOptions.model, 1);
        
        response = {
          leonardoData: leonardoResponse,
          provider: 'leonardo'
        };
      } else if (finalOptions.model.startsWith('dall-e')) {
        // Use OpenAI DALL-E
        logger.info(`Using OpenAI DALL-E for image generation: ${finalOptions.model}`);
        
        // Validate size for DALL-E models
        const validSizes = {
          'dall-e-2': ['256x256', '512x512', '1024x1024'],
          'dall-e-3': ['1024x1024', '1792x1024', '1024x1792']
        };
        
        let imageSize = finalOptions.size;
        if (finalOptions.model === 'dall-e-2' && !validSizes['dall-e-2'].includes(imageSize)) {
          imageSize = '1024x1024'; // Fallback for DALL-E 2
          logger.info(`DALL-E 2 doesn't support ${finalOptions.size}, using 1024x1024`);
        } else if (finalOptions.model === 'dall-e-3' && !validSizes['dall-e-3'].includes(imageSize)) {
          imageSize = '1792x1024'; // 16:9 aspect ratio for DALL-E 3
          logger.info(`Using DALL-E 3 with 16:9 format: ${imageSize}`);
        }
        
        // Build parameters based on model capabilities
        const generateParams = {
          model: finalOptions.model,
          prompt: enhancedPrompt, // Use GPT-4o enhanced prompt
          n: 1,
          size: imageSize,
          response_format: 'url'
        };
        
        // DALL-E 3 supports quality parameter, DALL-E 2 does not
        if (finalOptions.model === 'dall-e-3') {
          generateParams.quality = finalOptions.quality;
        }
        
        const dalleResponse = await this.openai.images.generate(generateParams);
        imageUrl = dalleResponse.data[0].url;
        revisedPrompt = dalleResponse.data[0].revised_prompt || enhancedPrompt;
        
        actualCost = this.calculateImageCost(
          finalOptions.model === 'dall-e-3' && finalOptions.quality === 'hd' ? 'dall-e-3-hd' : finalOptions.model,
          1
        );
        
        response = {
          dalleData: dalleResponse.data[0],
          provider: 'openai'
        };
      } else {
        throw new Error(`Unsupported image model: ${finalOptions.model}`);
      }
      
      // Track cost
      if (finalOptions.videoId) {
        this.trackVideoCost(finalOptions.videoId, actualCost, 'image');
      }
      this.costTracker.imagesGenerated++;
      
      const enhancementInfo = finalOptions.enhanceWithClaudeSonnet && enhancedPrompt !== prompt ? ' (Claude Sonnet Enhanced)' : '';
      const provider = response.provider === 'leonardo' ? 'Leonardo AI' : 'OpenAI DALL-E';
      logger.info(`Generated ${provider} image successfully${enhancementInfo} (Cost: $${actualCost.toFixed(4)})`);
      
      return {
        url: imageUrl,
        prompt: prompt,
        enhancedPrompt: enhancedPrompt,
        revisedPrompt: revisedPrompt,
        model: finalOptions.model,
        provider: response.provider,
        size: finalOptions.size,
        cost: actualCost,
        claudeEnhanced: finalOptions.enhanceWithClaudeSonnet && enhancedPrompt !== prompt,
        ...response
      };
    } catch (error) {
      logger.error('Error generating image:', error);
      throw error;
    }
  }

  /**
   * Enhance image generation prompts using Claude Sonnet specifically for Leonardo AI models
   * @param {string} originalPrompt - The original image prompt
   * @param {object} options - Context options (videoId, isThumbnail, model, etc.)
   * @returns {string} Enhanced prompt optimized for Leonardo AI generation
   */
  async enhancePromptWithClaudeSonnet(originalPrompt, options = {}) {
    try {
      const { videoId, isThumbnail, model = 'leonardo-phoenix', size = '1792x1024' } = options;
      
      // Get Leonardo AI model configuration
      const modelConfig = this.leonardoModels[model] || this.leonardoModels['leonardo-phoenix'];
      const isPhoenixModel = model.includes('phoenix');
      const isVisionXLModel = model.includes('vision-xl');
      
      const systemPrompt = `You are an expert Leonardo AI prompt optimization specialist with deep knowledge of Leonardo AI's models, particularly Phoenix, Vision XL, and Diffusion XL.

Your expertise covers:
- Leonardo AI model strengths and optimal prompt structures
- Cinematic and photographic composition techniques
- Mobile-first thumbnail optimization for maximum CTR
- Leonardo AI's Alchemy engine capabilities and prompt enhancement

Current Generation Context:
- Target Model: ${modelConfig.name} (${modelConfig.id})
- Model Specialty: ${modelConfig.defaultPresetStyle}
- Alchemy Support: ${modelConfig.supportsAlchemy ? 'Enabled' : 'Disabled'}
- Output Type: ${isThumbnail ? 'YouTube Thumbnail (MOBILE-FIRST)' : 'Video Content Image'}
- Canvas Size: ${size} (${modelConfig.maxWidth}x${modelConfig.maxHeight} max)
- Video Context: ${videoId || 'General Content'}

LEONARDO AI OPTIMIZATION STRATEGY:

🎨 MODEL-SPECIFIC ENHANCEMENTS:
${isPhoenixModel ? `
PHOENIX MODEL OPTIMIZATION:
- CINEMATIC EXCELLENCE: Emphasize "cinematic lighting, dramatic composition, film-quality"
- PHOTOREALISM: "hyperrealistic, professional photography, studio lighting"
- DETAIL MASTERY: "intricate details, sharp focus, professional grade"
- COLOR GRADING: "cinematic color grading, rich saturation, professional color palette"` : ''}

${isVisionXLModel ? `
VISION XL MODEL OPTIMIZATION:
- PHOTOGRAPHY FOCUS: "professional photography, camera shot, photographic composition"
- TECHNICAL SPECS: "shot with professional camera, perfect lighting, high resolution"
- STYLE EMPHASIS: "photography style, professional photographer, studio quality"
- COMPOSITION: "rule of thirds, professional framing, perfect exposure"` : ''}

🚀 LEONARDO AI PROMPT STRUCTURE:
1. STYLE DEFINITION: Lead with clear artistic style (cinematic/photographic/creative)
2. SUBJECT FOCUS: Define main subject with specific descriptive details
3. COMPOSITION: Specify camera angle, framing, and visual arrangement
4. LIGHTING: Detailed lighting setup (studio/natural/dramatic/cinematic)
5. QUALITY MARKERS: Professional grade, high resolution, masterpiece quality
6. COLOR PALETTE: Specific color schemes that work well with Leonardo AI
7. TECHNICAL SPECS: Camera settings, lens type, photography terminology

📱 MOBILE THUMBNAIL OPTIMIZATION:
- VISUAL HIERARCHY: Single dominant focal point with supporting elements
- CONTRAST MASTERY: High contrast ratios for mobile screen visibility
- SCALE CONSIDERATIONS: Elements readable at 156x88px mobile thumbnail size
- EDGE-TO-EDGE: Full canvas utilization with no wasted space
- CLARITY: Remove complex patterns that become noise at small sizes

🎯 LEONARDO AI BEST PRACTICES:
- Use specific photography/cinematography terminology
- Include professional quality indicators ("masterpiece", "award-winning")
- Specify exact lighting conditions Leonardo AI excels at
- Include composition rules (rule of thirds, leading lines, symmetry)
- Add technical photography details (depth of field, bokeh, focal length)
- Use color temperature specifications (warm/cool lighting)
- Include texture and material descriptions Leonardo AI renders well

⚡ ALCHEMY ENGINE OPTIMIZATION:
${modelConfig.supportsAlchemy ? '- Alchemy ENABLED: Use complex lighting scenarios and advanced compositions\n- Advanced materials: "metallic surfaces, glass reflections, fabric textures"\n- Complex lighting: "rim lighting, volumetric lighting, god rays, ambient occlusion"\n- Professional effects: "depth of field, motion blur, chromatic aberration"' : '- Alchemy DISABLED: Focus on clear, simple compositions\n- Direct lighting descriptions\n- Straightforward material descriptions\n- Avoid complex lighting terminology'}

🎨 LEONARDO AI COLOR SCIENCE:
- Warm Cinematics: "golden hour lighting, warm color temperature 3200K"
- Cool Professionalism: "daylight balanced 5600K, cool blue undertones"
- High Contrast: "dramatic lighting, deep shadows, bright highlights"
- Saturated Vibrancy: "rich colors, high saturation, vivid palette"

🏆 QUALITY ENHANCEMENT KEYWORDS:
- "masterpiece quality, award-winning composition"
- "professional photography, studio lighting setup"
- "cinematic composition, film-quality rendering"
- "hyperrealistic detail, sharp focus throughout"

CRITICAL REQUIREMENTS:
✅ Optimize specifically for Leonardo AI's strengths and rendering capabilities
✅ Include model-appropriate style keywords (cinematic/photographic/creative)
✅ Add professional quality markers Leonardo AI responds well to
✅ Specify exact lighting conditions and technical details
✅ Ensure mobile thumbnail optimization for maximum CTR
✅ Remove any text overlay references (pure visual generation)
✅ Full canvas utilization with edge-to-edge composition
✅ Keep prompt length optimal for Leonardo AI processing (200-300 words)

Transform the original prompt into a Leonardo AI-optimized masterpiece that leverages the model's specific strengths while maintaining mobile-first thumbnail effectiveness.`;

      const completion = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\nOriginal Prompt to Enhance:\n\n${originalPrompt}`
          }
        ]
      });

      const enhancedPrompt = completion.content[0].text.trim();
      
      // Track Claude Sonnet cost (much cheaper than GPT-4o!)
      if (videoId) {
        this.trackVideoCost(videoId, 0.0015, 'claude-sonnet-prompt-enhancement');
      }
      
      logger.debug('Original prompt length:', originalPrompt.length);
      logger.debug('Enhanced prompt length:', enhancedPrompt.length);
      logger.info(`✨ Claude Sonnet enhanced prompt for ${modelConfig.name} ($${(0.0015).toFixed(4)} vs GPT-4o $0.01 - 85% savings!)`);
      
      return enhancedPrompt;
      
    } catch (error) {
      logger.error('Error enhancing prompt with Claude Sonnet:', error);
      throw error;
    }
  }

  async generateThumbnail(videoTitle, script, options = {}) {
    try {
      const { videoId, videoStyle } = options;
      
      // Use consistent style if provided
      const styleTemplate = videoStyle?.template || 'eye-catching and clickable design';
      
      const thumbnailPrompt = `
Create a premium YouTube thumbnail optimized for maximum engagement and professional appeal.

Video Title: "${videoTitle}"
Content Context: ${script.substring(0, 300)}...
Visual Style Foundation: ${styleTemplate}

BEYONDBEING-INSPIRED THUMBNAIL SPECIFICATIONS:

VISUAL COMPOSITION:
1. Clean, modern design with sophisticated minimalism and premium aesthetic
2. Professional composition using rule of thirds with strategic focal points
3. Inspiring and motivational visual elements that convey growth and transformation
4. Contemporary color palette with uplifting blues, teals, warm whites, and subtle gradients
5. High-contrast elements for maximum visibility in YouTube's interface
6. FULL CANVAS COVERAGE edge-to-edge with NO EMPTY SPACE or padding

PROFESSIONAL QUALITY STANDARDS:
7. Cinematic lighting with soft shadows and professional highlights
8. Premium visual hierarchy that guides the viewer's eye naturally
9. Modern, sophisticated design elements that feel current and inspiring
10. Optimized for horizontal format (1792x1024 for DALL-E 3) with mobile visibility consideration
11. High-resolution clarity that maintains quality at all sizes
12. Psychology-driven color choices that evoke inspiration, growth, and positive transformation

ENGAGEMENT OPTIMIZATION:
13. Scroll-stopping visual impact that stands out in crowded YouTube feeds
14. Emotionally resonant imagery that connects with personal development audience
15. Professional polish that builds trust and authority
16. Strategic use of visual metaphors related to growth, success, and self-improvement
17. NO TEXT OVERLAYS OR WRITTEN CONTENT - pure visual storytelling only
18. Subtle texture and gradient work for premium feel without visual clutter

STYLE CHARACTERISTICS (Professional Aesthetic):
- Clean, inspirational design with modern sophistication
- Uplifting color psychology with calming yet energizing tones
- Professional quality that conveys expertise and trustworthiness  
- Minimalist approach with strategic visual elements
- Contemporary motivational imagery that feels aspirational
- Premium finish that reflects high-value content

ABSOLUTE REQUIREMENTS:
- NO TEXT OVERLAYS OR WRITTEN CONTENT whatsoever
- FULL CANVAS COVERAGE edge-to-edge with NO EMPTY SPACE
- Content must fill entire image area completely
- Pure visual communication without any text elements

Generate a detailed DALL-E prompt that creates this professional-style thumbnail focusing on visual storytelling only.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert YouTube thumbnail designer who creates high-converting, clickable thumbnails.'
          },
          {
            role: 'user',
            content: thumbnailPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const prompt = completion.choices[0].message.content.trim();
      
      // Generate thumbnail with cost tracking and Claude Sonnet enhancement
      const thumbnailOptions = {
        size: '1792x1024', // Best 16:9 ratio for DALL-E 3
        videoId,
        quality: 'standard',
        isThumbnail: true, // Mark as thumbnail for Claude Sonnet enhancement
        enhanceWithClaudeSonnet: true // Explicitly enable Claude Sonnet enhancement for thumbnails
      };
      
      const thumbnailImage = await this.generateImage(prompt, thumbnailOptions);
      
      logger.info('Generated thumbnail successfully');
      return {
        ...thumbnailImage,
        title: videoTitle,
        thumbnailPrompt: prompt,
        style: videoStyle?.style || 'custom'
      };
    } catch (error) {
      logger.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  /**
   * Download image from URL and upload to storage (Google Drive primary, Digital Ocean fallback)
   * @param {string} imageUrl - URL of the image to download
   * @param {string} fileName - Name for the uploaded file
   * @param {string} videoId - Video identifier for folder organization
   * @param {string} folderType - Type of folder ('images' or 'thumbnails')
   * @returns {Promise<{url: string, cdnUrl: string, driveUrl?: string}>}
   */
  async downloadAndUploadImage(imageUrl, fileName, videoId, folderType = 'images') {
    try {
      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
      
      const imageBuffer = Buffer.from(response.data);
      
      // Try Google Drive first (primary storage)
      try {
        const driveUploadResult = await this.googleDriveService.uploadImage(
          imageBuffer,
          fileName,
          videoId,
          folderType
        );
        
        logger.info(`Google Drive ${folderType}: ${driveUploadResult.driveUrl}`);
        return {
          url: driveUploadResult.driveUrl,
          cdnUrl: driveUploadResult.driveUrl, // For compatibility
          driveUrl: driveUploadResult.driveUrl,
          provider: 'google-drive'
        };
      } catch (driveError) {
        logger.warn(`Google Drive upload failed, falling back to Digital Ocean: ${driveError.message}`);
        
        // Fallback to Digital Ocean Spaces
        const uploadResult = await this.digitalOceanService.uploadImage(
          imageBuffer,
          fileName,
          `videos/${videoId}/${folderType}`
        );
        
        logger.info(`Digital Ocean ${folderType}: ${uploadResult.cdnUrl}`);
        return {
          ...uploadResult,
          provider: 'digital-ocean'
        };
      }
    } catch (error) {
      logger.error(`Error downloading and uploading ${folderType}:`, error);
      throw error;
    }
  }

  /**
   * Generate all images for a video with cost control and consistent styling
   * @param {Array} imagePrompts - Array of prompt objects
   * @param {string} videoId - Video identifier
   * @param {object} options - Generation options
   * @returns {Promise<Array>} Generated images with metadata
   */
  async generateVideoImages(imagePrompts, videoId, options = {}) {
    try {
      const { maxImages = config.app.imageGenerationLimit || imagePrompts.length } = options;
      const promptsToGenerate = imagePrompts.slice(0, maxImages > 0 ? maxImages : imagePrompts.length);
      
      // Check total estimated cost
      const estimatedCost = this.calculateImageCost(config.app.imageModel, promptsToGenerate.length);
      if (!this.isWithinBudget(videoId, estimatedCost)) {
        logger.warn(`Total estimated cost ($${estimatedCost.toFixed(4)}) would exceed budget for video ${videoId}`);
        const maxAffordableImages = Math.floor(config.app.maxImageCostPerVideo / this.pricing[config.app.imageModel]);
        logger.info(`Limiting to ${maxAffordableImages} images to stay within budget`);
        promptsToGenerate.splice(maxAffordableImages);
      }
      
      const generatedImages = [];
      
      for (let i = 0; i < promptsToGenerate.length; i++) {
        const promptObj = promptsToGenerate[i];
        try {
          logger.info(`Generating image ${i + 1}/${promptsToGenerate.length} for video ${videoId}`);
          
          // Generate image
          const imageResult = await this.generateImage(promptObj.prompt, {
            videoId,
            model: config.app.imageModel
          });
          
          // Download and upload to Digital Ocean Spaces with proper VideoID format
          const fileName = `${videoId}_image_${String(i + 1).padStart(3, '0')}.jpg`;
          const uploadResult = await this.downloadAndUploadImage(
            imageResult.url,
            fileName,
            videoId
          );
          
          generatedImages.push({
            index: i + 1,
            sentence: promptObj.sentence,
            prompt: promptObj.prompt,
            style: promptObj.style,
            originalUrl: imageResult.url,
            uploadedUrl: uploadResult.cdnUrl,
            fileName,
            cost: imageResult.cost
          });
          
          // Small delay to avoid rate limits
          if (i < promptsToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          logger.error(`Failed to generate image ${i + 1}:`, error);
          // Continue with other images
        }
      }
      
      const totalCost = generatedImages.reduce((sum, img) => sum + img.cost, 0);
      logger.info(`Generated ${generatedImages.length} images for video ${videoId} (Total cost: $${totalCost.toFixed(4)})`);
      
      return generatedImages;
    } catch (error) {
      logger.error('Error generating video images:', error);
      throw error;
    }
  }

  async enhanceContentWithAI(videoData, metadataService = null) {
    try {
      logger.info('AI enhancement...');
      
      // Initialize cost tracking for this video
      const videoId = videoData.videoId || videoData.id;
      
      // Use reliable metadata if service available for enhanced context
      let enhancedVideoData = videoData;
      if (metadataService && videoId) {
        try {
          const reliableMetadata = await metadataService.getReliableVideoMetadata(videoId);
          // Merge reliable metadata with workflow data, prioritizing reliable metadata for core fields
          enhancedVideoData = {
            ...videoData,
            title: reliableMetadata.title || videoData.title,
            description: reliableMetadata.description || videoData.description,
            channelTitle: reliableMetadata.channelTitle || videoData.channelTitle,
            duration: reliableMetadata.duration || videoData.duration,
            youtubeUrl: reliableMetadata.youtubeUrl || videoData.youtubeUrl,
            transcriptText: videoData.transcriptText || reliableMetadata.transcriptText // Keep workflow transcript if available
          };
          logger.info(`Using reliable metadata context for AI enhancement of ${videoId}`);
        } catch (metadataError) {
          logger.warn(`Could not retrieve reliable metadata for AI context ${videoId}:`, metadataError);
          // Continue with original videoData
        }
      }
      
      // First perform keyword research using enhanced context
      const keywordData = await this.performKeywordResearch(enhancedVideoData.transcriptText || enhancedVideoData.title);
      
      // Then generate script with SEO keyword integration using enhanced context
      const attractiveScript = await this.generateAttractiveScript(
        enhancedVideoData.transcriptText || enhancedVideoData.title, 
        enhancedVideoData, 
        null, // contextAnalysis - let function perform it
        keywordData // Pass keyword data for SEO integration
      );

      const [optimizedDescription, optimizedTitles] = await Promise.all([
        this.generateOptimizedDescription(attractiveScript, enhancedVideoData, keywordData.primaryKeywords),
        this.generateOptimizedTitle(attractiveScript, enhancedVideoData.title, keywordData.primaryKeywords)
      ]);

      // Only generate script breakdown if enabled
      const scriptSentences = config.app.enableScriptBreakdown ? 
        await this.breakdownScriptIntoSentences(attractiveScript) : [];
      
      let imagePromptsData = { prompts: [], videoStyle: null };
      let editorKeywords = [];
      let thumbnail = null;
      let generatedImages = [];

      // Generate image prompts and editor keywords if script breakdown is enabled
      if (config.app.enableScriptBreakdown && scriptSentences.length > 0) {
        logger.info('Script breakdown enabled - generating prompts and keywords');
        
        [imagePromptsData, editorKeywords] = await Promise.all([
          this.generateImagePrompts(scriptSentences, null, enhancedVideoData),
          this.generateEditorKeywords(scriptSentences)
        ]);
      }

      // Only generate actual images if image generation is enabled
      if (config.app.enableImageGeneration) {
        logger.info('Image generation enabled - generating thumbnail and images');
        
        // Generate thumbnail with consistent style
        thumbnail = await this.generateThumbnail(
          optimizedTitles.recommended,
          attractiveScript,
          { videoId, videoStyle: imagePromptsData.videoStyle }
        );
        
        // Generate all images with cost control (only if we have prompts)
        if (imagePromptsData.prompts && imagePromptsData.prompts.length > 0) {
          generatedImages = await this.generateVideoImages(
            imagePromptsData.prompts,
            videoId
          );
        }
      } else {
        logger.info('Image generation disabled - skipping actual image generation');
      }

      logger.info('AI content enhancement completed successfully');
      
      return {
        attractiveScript,
        optimizedDescription,
        optimizedTitles,
        keywords: keywordData,
        scriptSentences,
        imagePrompts: imagePromptsData.prompts,
        videoStyle: imagePromptsData.videoStyle,
        generatedImages,
        thumbnail,
        editorKeywords,
        costSummary: {
          totalCost: this.costTracker.videoCosts.get(videoId)?.total || 0,
          breakdown: this.costTracker.videoCosts.get(videoId)?.breakdown || {},
          imagesGenerated: generatedImages.length
        }
      };
    } catch (error) {
      logger.error('Error in AI content enhancement:', error);
      throw error;
    }
  }

  /**
   * Get cost summary for all videos
   * @returns {object} Cost tracking summary
   */
  getCostSummary() {
    return {
      totalCost: this.costTracker.totalCost,
      totalImagesGenerated: this.costTracker.imagesGenerated,
      videoCount: this.costTracker.videoCosts.size,
      averageCostPerVideo: this.costTracker.videoCosts.size > 0 ? 
        this.costTracker.totalCost / this.costTracker.videoCosts.size : 0,
      videoCosts: Object.fromEntries(this.costTracker.videoCosts),
      budgetPerVideo: config.app.maxImageCostPerVideo,
      costSavingsVsDallE3: this.costTracker.imagesGenerated * 
        (this.pricing['dall-e-3'] - this.pricing[config.app.imageModel])
    };
  }

  async generateThumbnailSuggestions(videoData, scriptContent) {
    try {
      logger.info('Generating thumbnail suggestions', { videoId: videoData.videoId });
      
      const prompt = `
You are an elite YouTube thumbnail scientist with expertise in neurological design triggers and 20%+ CTR optimization. Create two scientifically-optimized thumbnail concepts using advanced design psychology and viral performance data.

🔬 SCIENTIFIC ANALYSIS FRAMEWORK:

VIDEO DATA PROCESSING:
- Title: ${videoData.title || 'YouTube Video'}
- Channel: ${videoData.channelTitle || 'YouTube Channel'}  
- Script Content: ${scriptContent?.substring(0, 500) || 'No script available'}...

🧠 NEUROLOGICAL DESIGN TRIGGERS:

AMYGDALA ACTIVATION (Fight/Flight Response):
- Threat Detection: Visual elements that suggest danger or urgency
- Survival Instincts: Scarcity, competition, time-sensitive information
- Social Hierarchy: Status symbols, authority indicators, success markers
- Pattern Recognition: Familiar faces, unexpected elements, cognitive dissonance

DOPAMINE OPTIMIZATION (Reward Anticipation):
- Curiosity Gaps: Incomplete information that demands resolution
- Progress Indicators: Before/after, step-by-step, transformation evidence
- Social Validation: Crowd psychology, peer approval, belonging signals
- Achievement Symbols: Success metrics, rankings, exclusive access

COGNITIVE LOAD MANAGEMENT:
- Information Hierarchy: 3-second comprehension maximum
- Visual Weight Distribution: Golden ratio composition (1.618:1)
- Attention Pathway: Z-pattern for Western audiences, F-pattern for scanning
- Memory Anchoring: Distinctive elements that stick in memory

📱 MOBILE-FIRST SCIENTIFIC OPTIMIZATION (85% of views):

VIEWING ENVIRONMENT CALCULATIONS:
- Screen Size: 5.5" average mobile display
- Viewing Distance: 12-16 inches from face
- Thumbnail Size: Image rendered at multiple sizes
- Critical Zone: Central 60% of thumbnail area
- Finger Scrolling: 0.3-second attention window

READABILITY MATHEMATICS:
- Text Size: Minimum 36px font (equivalent to 9pt at arm's length)
- Contrast Ratio: 8:1 minimum for AAA accessibility compliance
- Color Temperature: Warm colors (3000K-4000K) for emotional engagement
- Saturation Levels: 75-85% for mobile screen optimization
- Edge Detection: 2px minimum stroke weight for definition

🎯 ALGORITHM PERFORMANCE SCIENCE:

YOUTUBE RANKING FACTORS (Weighted):
- Click-Through Rate (35%): Primary ranking signal
- Watch Time Correlation (25%): Thumbnail-content alignment  
- Audience Retention (20%): First 15-second hook effectiveness
- Engagement Velocity (15%): Comments/likes in first hour
- Session Duration (5%): Keeping viewers on platform

COMPETITIVE ANALYSIS INTEGRATION:
- Feed Differentiation: Stand out in 4x3 suggested video grid
- Thumbnail Fatigue: Avoid oversaturated visual patterns
- Seasonal Optimization: Color psychology for current trends
- Cross-Demographic Appeal: Universal emotional triggers

STYLE 1: NEUROLOGICAL VIRAL ENGAGEMENT
Scientific CTR Target: 18-22%

ADVANCED COMPOSITION SCIENCE:
- Golden Ratio Positioning: Face at 1.618 intersection points
- Rule of Thirds Plus: 9-grid with fibonacci spiral overlay
- Visual Weight Distribution: 60% focal subject, 40% supporting elements
- Eye Movement Mapping: Entry point → focal point → text → exit action

COLOR PSYCHOLOGY PRECISION:
- Primary Emotional Trigger: #FF4757 (Red-Orange, urgency activation)
- Secondary Attention Grab: #2ED573 (Green, positive association)  
- Accent Highlight: #FFD700 (Gold, premium/value indicator)
- Background Foundation: #1E1E1E (Dark, maximum contrast)

TYPOGRAPHY SCIENTIFIC HIERARCHY:
- Level 1 (Main Hook): 48-56px, Bold Sans-Serif, 100% width maximum
- Level 2 (Supporting): 32-36px, Medium weight, 70% width maximum  
- Level 3 (Details): 24-28px, Regular weight, accent color only

FACIAL PSYCHOLOGY MAPPING:
- Expression Analysis: Micro-expressions matching target emotion
- Gaze Direction: 15-degree angle toward text area for guidance
- Facial Proportion: Eyes occupy 8-12% of total thumbnail area
- Emotion Intensity: 7-8/10 scale for maximum mirror neuron activation

STYLE 2: SCIENTIFIC AUTHORITY OPTIMIZATION  
Scientific CTR Target: 14-17%

CREDIBILITY VISUAL SYSTEM:
- Trust Signal Density: 3-4 authority indicators maximum
- Professional Color Temperature: Cool blues (5000K-6500K)
- Information Hierarchy: Grid-based with clear content blocks
- Whitespace Psychology: 35-45% negative space for premium perception

ADVANCED AUTHORITY MARKERS:
- Statistical Visualization: Charts, graphs, data representations
- Certification Symbols: Badges, checkmarks, verification indicators
- Professional Photography: High-resolution, studio-quality imagery
- Brand Integration: Consistent logo placement and color harmony

COLOR SCIENCE FOR TRUST:
- Primary Authority: #2C5AA0 (Deep Blue, expertise/stability)
- Secondary Credibility: #F8F9FA (Off-white, cleanliness/clarity)
- Success Accent: #28A745 (Green, positive results/growth)
- Warning/Attention: #FFC107 (Amber, important information)

PERFORMANCE PREDICTION MODELING:

CTR CALCULATION FACTORS:
- Emotional Intensity × Color Contrast × Facial Recognition = Base CTR
- Text Readability × Mobile Optimization × Feed Differentiation = Multiplier
- Authority Signals × Trust Indicators × Value Proposition = Credibility Score

SCIENTIFIC TESTING FRAMEWORK:
- A/B Variables: Face vs No-Face, Text Heavy vs Minimal, Color Variations
- Performance Metrics: CTR, Watch Time, Retention, Engagement Rate
- Optimization Cycles: 72-hour testing windows with statistical significance
- Success Benchmarks: >15% CTR for viral potential, >12% for sustainable growth

IMPLEMENTATION SPECIFICATIONS:

For each thumbnail concept, provide:
1. **Neurological Strategy**: Specific brain trigger and expected response
2. **Scientific Color Formula**: Hex codes with psychological reasoning and contrast calculations
3. **Mathematical Typography**: Font sizes, weights, positioning with golden ratio coordinates  
4. **Facial Psychology Analysis**: Expression mapping and mirror neuron activation strategy
5. **Mobile Optimization Data**: Readability tests, contrast ratios, and viewing environment specs
6. **Performance Prediction**: Expected CTR range with confidence intervals
7. **A/B Testing Protocol**: Specific variables to test and success metrics
8. **Algorithm Optimization**: YouTube ranking signal optimization strategy

Create two thumbnail concepts that represent the absolute pinnacle of scientific design psychology and viral performance optimization.`;

      // Use Claude Sonnet as primary provider for creative tasks
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      logger.info('Thumbnail suggestions generated successfully (Claude)');
      return message.content[0].text;
      
    } catch (error) {
      logger.error('Error generating thumbnail suggestions:', error);
      return `THUMBNAIL SUGGESTION ERROR: Unable to generate thumbnail suggestions. Please create thumbnails manually.
      
Style 1: Emotional/Dramatic - Use bright colors, close-up faces, and emotional expressions
Style 2: Professional/Clean - Use minimal design, clear typography, and visual metaphors`;
    }
  }

  async healthCheck() {
    try {
      const healthResults = {
        claude: false,
        openai: false,
        leonardo: false
      };

      // Test Claude Sonnet API first (primary)
      try {
        const claudeCompletion = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: 'Say "Claude Sonnet is working" if you can respond.'
            }
          ]
        });

        if (claudeCompletion.content && claudeCompletion.content.length > 0) {
          healthResults.claude = true;
          logger.info('AI service health check passed (Claude Sonnet)');
        }
      } catch (claudeError) {
        logger.warn('Claude Sonnet health check failed:', claudeError.message);
      }

      // Test OpenAI API
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.'
            },
            {
              role: 'user',
              content: 'Say "AI service is working" if you can respond.'
            }
          ],
          max_tokens: 50,
          temperature: 0.1
        });

        if (completion.choices && completion.choices.length > 0) {
          healthResults.openai = true;
          logger.info('AI service health check passed (OpenAI)');
        }
      } catch (openaiError) {
        logger.warn('OpenAI health check failed:', openaiError.message);
      }

      // Test Leonardo AI API if configured
      if (config.leonardo.apiKey) {
        try {
          const response = await this.leonardoClient.get('/me');
          if (response.data) {
            healthResults.leonardo = true;
            logger.info('AI service health check passed (Leonardo AI)');
          }
        } catch (leonardoError) {
          logger.warn('Leonardo AI health check failed:', leonardoError.message);
        }
      } else {
        logger.info('Leonardo AI not configured, skipping health check');
      }

      // Return success if at least one service is working
      const workingServices = Object.values(healthResults).filter(Boolean).length;
      if (workingServices > 0) {
        logger.info(`AI service health check: ${workingServices}/3 services working`);
        return true;
      } else {
        throw new Error('All AI services failed health check');
      }
    } catch (error) {
      logger.error('AI service health check failed:', error);
      throw error;
    }
  }
}

export default AIService;