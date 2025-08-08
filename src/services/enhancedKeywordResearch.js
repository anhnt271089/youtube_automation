/**
 * Enhanced Keyword Research Service
 * Implements advanced content SEO best practices for YouTube automation
 */

class EnhancedKeywordResearch {
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Comprehensive keyword research with SEO best practices
   * @param {string} videoContent - Full video content (transcript + metadata)
   * @param {object} videoMetadata - Video metadata including title, description, etc.
   * @param {string} targetAudience - Specific audience segment
   * @returns {Promise<object>} Enhanced keyword data
   */
  async performEnhancedKeywordResearch(videoContent, videoMetadata, targetAudience = '') {
    try {
      // Step 1: Analyze content depth and context
      const contentAnalysis = await this.analyzeContentContext(videoContent, videoMetadata);
      
      // Step 2: Generate comprehensive keyword research
      const keywordData = await this.generateComprehensiveKeywords(
        videoContent, 
        videoMetadata, 
        contentAnalysis,
        targetAudience
      );
      
      // Step 3: Perform search intent analysis
      const intentAnalysis = await this.analyzeSearchIntent(keywordData);
      
      // Step 4: Generate semantic keyword variations
      const semanticKeywords = await this.generateSemanticKeywords(
        keywordData.primaryKeywords, 
        contentAnalysis.mainTopics
      );
      
      // Step 5: Create question-based keywords
      const questionKeywords = await this.generateQuestionKeywords(
        videoContent,
        keywordData.primaryKeywords
      );
      
      // Step 6: Generate competitive keywords
      const competitiveKeywords = await this.generateCompetitiveKeywords(
        contentAnalysis.niche,
        keywordData.primaryKeywords
      );
      
      return {
        ...keywordData,
        searchIntent: intentAnalysis,
        semanticKeywords,
        questionKeywords,
        competitiveKeywords,
        contentAnalysis,
        recommendations: this.generateKeywordRecommendations(keywordData, contentAnalysis)
      };
    } catch (error) {
      console.error('Enhanced keyword research failed:', error);
      // Fallback to basic keyword research
      return this.aiService.performKeywordResearch(videoContent);
    }
  }

  /**
   * Analyze content context for better keyword targeting
   */
  async analyzeContentContext(videoContent, videoMetadata) {
    const prompt = `
Analyze the following video content for comprehensive SEO context analysis:

Title: ${videoMetadata.title || 'N/A'}
Description: ${videoMetadata.description?.substring(0, 300) || 'N/A'}
Content: ${videoContent.substring(0, 1500)}

Perform deep content analysis and return JSON with:

{
  "mainTopics": ["primary topic 1", "primary topic 2", "primary topic 3"],
  "niche": "specific niche/industry",
  "contentType": "educational|entertainment|review|tutorial|news|lifestyle",
  "audienceLevel": "beginner|intermediate|advanced|mixed",
  "contentPurpose": "inform|entertain|persuade|teach|review|inspire",
  "keyEntities": ["entity 1", "entity 2", "entity 3"],
  "problemsSolved": ["problem 1", "problem 2"],
  "benefitsOffered": ["benefit 1", "benefit 2"],
  "emotionalTriggers": ["trigger 1", "trigger 2"],
  "contentDepth": "surface|moderate|comprehensive",
  "uniqueAngles": ["unique angle 1", "unique angle 2"]
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content strategist and SEO analyst specializing in content context analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Content analysis failed:', error);
      return {
        mainTopics: ['general content'],
        niche: 'general',
        contentType: 'educational',
        audienceLevel: 'mixed',
        contentPurpose: 'inform',
        keyEntities: [],
        problemsSolved: [],
        benefitsOffered: [],
        emotionalTriggers: [],
        contentDepth: 'moderate',
        uniqueAngles: []
      };
    }
  }

  /**
   * Generate comprehensive keyword research with multiple categories
   */
  async generateComprehensiveKeywords(videoContent, videoMetadata, contentAnalysis, targetAudience) {
    const prompt = `
As a senior SEO specialist, perform comprehensive keyword research for YouTube content optimization:

CONTENT ANALYSIS:
- Main Topics: ${contentAnalysis.mainTopics.join(', ')}
- Niche: ${contentAnalysis.niche}
- Content Type: ${contentAnalysis.contentType}
- Audience Level: ${contentAnalysis.audienceLevel}
- Target Audience: ${targetAudience || 'General'}

VIDEO CONTENT: ${videoContent.substring(0, 1200)}

COMPREHENSIVE KEYWORD RESEARCH REQUIREMENTS:

1. PRIMARY KEYWORDS (8-12): High search volume, directly relevant to main content
2. LONG-TAIL KEYWORDS (12-15): Specific phrases, lower competition, higher intent
3. TRENDING HASHTAGS (6-8): Current social media trends relevant to content
4. RELATED TOPICS (8-10): Adjacent topics for content expansion and topical authority
5. LOCATION KEYWORDS (3-5): Geographic variations if applicable to content
6. BRANDED KEYWORDS (4-6): Variations combining brand/creator name with topics
7. SEASONAL KEYWORDS (3-5): Time-sensitive opportunities related to content
8. VOICE SEARCH KEYWORDS (5-7): Natural language, conversational queries

KEYWORD SELECTION CRITERIA:
- Search intent alignment with content purpose
- Semantic relevance to main topics
- Competition level consideration (mix of high and low competition)
- Audience-specific language and terminology
- YouTube-specific optimization (video-focused terms)

Return as JSON:
{
  "primaryKeywords": [],
  "longTailKeywords": [],
  "trendingHashtags": [],
  "relatedTopics": [],
  "locationKeywords": [],
  "brandedKeywords": [],
  "seasonalKeywords": [],
  "voiceSearchKeywords": []
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a senior YouTube SEO specialist with expertise in comprehensive keyword research and content optimization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.5
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Comprehensive keyword generation failed:', error);
      // Fallback to basic structure
      return {
        primaryKeywords: [],
        longTailKeywords: [],
        trendingHashtags: [],
        relatedTopics: [],
        locationKeywords: [],
        brandedKeywords: [],
        seasonalKeywords: [],
        voiceSearchKeywords: []
      };
    }
  }

  /**
   * Analyze search intent for generated keywords
   */
  async analyzeSearchIntent(keywordData) {
    const allKeywords = [
      ...keywordData.primaryKeywords,
      ...keywordData.longTailKeywords,
      ...keywordData.voiceSearchKeywords || []
    ];

    const prompt = `
Classify the following keywords by search intent for YouTube SEO optimization:

Keywords: ${allKeywords.join(', ')}

SEARCH INTENT CATEGORIES:
- INFORMATIONAL: Seeking knowledge, how-to, explanations ("how to", "what is", "why does")
- NAVIGATIONAL: Looking for specific content/channel ("brand name", "specific video")
- TRANSACTIONAL: Ready to take action ("buy", "download", "sign up", "get")
- COMMERCIAL: Research before buying ("best", "review", "comparison", "vs")

Return as JSON:
{
  "informational": [],
  "navigational": [],
  "transactional": [],
  "commercial": [],
  "mixed": []
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in search intent analysis and user behavior patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.3
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Search intent analysis failed:', error);
      return {
        informational: allKeywords.slice(0, 5),
        navigational: [],
        transactional: [],
        commercial: [],
        mixed: []
      };
    }
  }

  /**
   * Generate semantic keyword variations and LSI terms
   */
  async generateSemanticKeywords(primaryKeywords, mainTopics) {
    const prompt = `
Generate semantic keyword variations and LSI (Latent Semantic Indexing) terms for comprehensive content coverage:

Primary Keywords: ${primaryKeywords.join(', ')}
Main Topics: ${mainTopics.join(', ')}

SEMANTIC SEO REQUIREMENTS:
1. SYNONYMS & VARIATIONS: Different ways to express the same concepts
2. RELATED ENTITIES: People, places, things, concepts connected to main topics
3. CO-OCCURRING TERMS: Words frequently found together with primary keywords
4. SEMANTIC VARIATIONS: Different grammatical forms and expressions
5. CONTEXTUAL KEYWORDS: Terms that provide topical context and authority

Focus on:
- Natural language variations
- Industry-specific terminology
- User-friendly alternatives to technical terms
- Emotional and descriptive modifiers
- Action-oriented variations

Return as JSON array of 15-20 semantic keywords:
{
  "semanticKeywords": []
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in semantic SEO and natural language processing for content optimization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.6
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(responseText);
      return result.semanticKeywords || [];
    } catch (error) {
      console.error('Semantic keyword generation failed:', error);
      return [];
    }
  }

  /**
   * Generate question-based keywords for voice search and featured snippets
   */
  async generateQuestionKeywords(videoContent, primaryKeywords) {
    const prompt = `
Generate question-based keywords optimized for voice search, featured snippets, and "People Also Ask" sections:

Video Content: ${videoContent.substring(0, 800)}
Primary Keywords: ${primaryKeywords.join(', ')}

QUESTION TYPES TO GENERATE:
1. HOW-TO QUESTIONS: "How to...", "How do you...", "How can I..."
2. WHAT QUESTIONS: "What is...", "What are...", "What does..."
3. WHY QUESTIONS: "Why is...", "Why do...", "Why should..."
4. WHERE QUESTIONS: "Where to...", "Where can I...", "Where is..."
5. WHEN QUESTIONS: "When to...", "When should...", "When is..."
6. WHO QUESTIONS: "Who is...", "Who should...", "Who can..."
7. COMPARISON QUESTIONS: "What's the difference between...", "Which is better..."
8. PROBLEM-SOLVING: "Why won't...", "What happens if...", "How to fix..."

Focus on:
- Natural conversational language
- Common user pain points
- Voice search optimization (longer, conversational queries)
- Featured snippet opportunities
- FAQ-style questions

Return as JSON array of 12-15 question keywords:
{
  "questionKeywords": []
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in voice search optimization and question-based keyword research.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(responseText);
      return result.questionKeywords || [];
    } catch (error) {
      console.error('Question keyword generation failed:', error);
      return [];
    }
  }

  /**
   * Generate competitive keywords for gap analysis
   */
  async generateCompetitiveKeywords(niche, primaryKeywords) {
    const prompt = `
Generate competitive keywords for gap analysis and market opportunity identification:

Niche/Industry: ${niche}
Primary Keywords: ${primaryKeywords.join(', ')}

COMPETITIVE KEYWORD STRATEGIES:
1. COMPETITOR TERMS: Keywords competitors likely rank for
2. MARKET GAPS: Underserved keyword opportunities
3. ALTERNATIVE APPROACHES: Different angles to same topics
4. EMERGING TRENDS: New terminology and trending concepts
5. LONG-TAIL OPPORTUNITIES: Specific niches with less competition
6. BRANDED ALTERNATIVES: Non-branded versions of popular searches

Focus on:
- Lower competition opportunities
- Specific audience segments
- Alternative terminology
- Emerging trends in the niche
- Underserved sub-topics

Return as JSON:
{
  "competitorKeywords": [],
  "gapOpportunities": [],
  "emergingTrends": [],
  "alternativeTerms": []
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive analysis expert specializing in keyword gap analysis and market opportunity identification.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.6
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Competitive keyword generation failed:', error);
      return {
        competitorKeywords: [],
        gapOpportunities: [],
        emergingTrends: [],
        alternativeTerms: []
      };
    }
  }

  /**
   * Generate actionable keyword recommendations
   */
  generateKeywordRecommendations(keywordData, _contentAnalysis) {
    const recommendations = [];

    // Title optimization recommendations
    const titleKeywords = [
      ...keywordData.primaryKeywords.slice(0, 2),
      ...keywordData.longTailKeywords.slice(0, 1)
    ];
    
    recommendations.push({
      type: 'title_optimization',
      priority: 'high',
      suggestion: `Include these keywords in title: ${titleKeywords.join(', ')}`,
      keywords: titleKeywords
    });

    // Description optimization
    const descriptionKeywords = [
      ...keywordData.primaryKeywords.slice(0, 3),
      ...keywordData.longTailKeywords.slice(0, 2),
      ...keywordData.semanticKeywords?.slice(0, 2) || []
    ];
    
    recommendations.push({
      type: 'description_optimization',
      priority: 'high',
      suggestion: `Naturally integrate these keywords in description: ${descriptionKeywords.join(', ')}`,
      keywords: descriptionKeywords
    });

    // Tags recommendations
    const tagKeywords = [
      ...keywordData.primaryKeywords,
      ...keywordData.longTailKeywords.slice(0, 5),
      ...keywordData.relatedTopics.slice(0, 3)
    ];
    
    recommendations.push({
      type: 'tags_optimization',
      priority: 'medium',
      suggestion: 'Use these keywords as video tags',
      keywords: tagKeywords.slice(0, 15) // YouTube allows up to 15 tags
    });

    // Content expansion opportunities
    if (keywordData.questionKeywords?.length > 0) {
      recommendations.push({
        type: 'content_expansion',
        priority: 'medium',
        suggestion: 'Create follow-up content around these questions',
        keywords: keywordData.questionKeywords.slice(0, 3)
      });
    }

    return recommendations;
  }
}

export default EnhancedKeywordResearch;