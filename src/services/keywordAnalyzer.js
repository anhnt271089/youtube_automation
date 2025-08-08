/**
 * Keyword Analysis and Optimization Tool
 * Provides content SEO analysis and keyword optimization recommendations
 */

class KeywordAnalyzer {
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Analyze keyword performance and provide optimization recommendations
   * @param {object} keywordData - Generated keyword data
   * @param {string} content - Video content for analysis
   * @param {object} metadata - Video metadata
   * @returns {Promise<object>} Analysis and recommendations
   */
  async analyzeKeywordStrategy(keywordData, content, metadata) {
    try {
      const analysis = await this.performKeywordAnalysis(keywordData, content, metadata);
      const recommendations = this.generateOptimizationRecommendations(analysis, keywordData);
      const competitiveInsights = await this.analyzeCompetitiveKeywords(keywordData);
      
      return {
        analysis,
        recommendations,
        competitiveInsights,
        optimizationScore: this.calculateOptimizationScore(analysis),
        actionableSteps: this.generateActionableSteps(recommendations)
      };
    } catch (error) {
      console.error('Keyword strategy analysis failed:', error);
      return this.generateFallbackAnalysis(keywordData);
    }
  }

  /**
   * Perform comprehensive keyword analysis
   */
  async performKeywordAnalysis(keywordData, content, metadata) {
    const prompt = `
Analyze the following keyword strategy for SEO effectiveness and provide detailed insights:

KEYWORD DATA:
Primary Keywords: ${keywordData.primaryKeywords?.join(', ') || 'None'}
Long-tail Keywords: ${keywordData.longTailKeywords?.join(', ') || 'None'}
Semantic Keywords: ${keywordData.semanticKeywords?.join(', ') || 'None'}
Question Keywords: ${keywordData.questionKeywords?.join(', ') || 'None'}
Competitive Keywords: ${keywordData.competitiveKeywords?.join(', ') || 'None'}

VIDEO CONTENT SAMPLE: ${content.substring(0, 600)}

TITLE: ${metadata.title || 'No title provided'}

ANALYSIS REQUIREMENTS:

Evaluate and return JSON analysis:
{
  "keywordRelevance": {
    "score": 0-10,
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  },
  "searchIntentAlignment": {
    "score": 0-10,
    "primaryIntent": "informational|transactional|navigational|commercial",
    "intentMatch": true/false,
    "recommendations": ["rec 1", "rec 2"]
  },
  "competitionAnalysis": {
    "difficultyLevel": "low|medium|high",
    "opportunities": ["opp 1", "opp 2"],
    "threats": ["threat 1", "threat 2"]
  },
  "semanticCoverage": {
    "score": 0-10,
    "coverage": "poor|fair|good|excellent",
    "missingTerms": ["term 1", "term 2"]
  },
  "longTailOpportunities": {
    "score": 0-10,
    "qualityAssessment": "poor|fair|good|excellent",
    "improvements": ["improvement 1", "improvement 2"]
  },
  "overallAssessment": {
    "totalScore": 0-100,
    "grade": "A|B|C|D|F",
    "keyStrengths": ["strength 1", "strength 2"],
    "criticalIssues": ["issue 1", "issue 2"]
  }
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a senior SEO analyst specializing in keyword strategy evaluation and optimization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Keyword analysis failed:', error);
      return this.generateFallbackAnalysis(keywordData);
    }
  }

  /**
   * Generate optimization recommendations based on analysis
   */
  generateOptimizationRecommendations(analysis, keywordData) {
    const recommendations = [];

    // Title optimization
    if (analysis.searchIntentAlignment.score < 7) {
      recommendations.push({
        priority: 'high',
        category: 'title_optimization',
        issue: 'Poor search intent alignment in title',
        solution: 'Rewrite title to better match user search intent',
        keywords: keywordData.primaryKeywords?.slice(0, 2) || [],
        impact: 'High - Improves CTR and ranking potential'
      });
    }

    // Content optimization
    if (analysis.keywordRelevance.score < 8) {
      recommendations.push({
        priority: 'high',
        category: 'content_optimization',
        issue: 'Weak keyword relevance in content',
        solution: 'Better integrate primary keywords naturally throughout content',
        keywords: keywordData.primaryKeywords || [],
        impact: 'High - Improves topical relevance and ranking'
      });
    }

    // Semantic SEO
    if (analysis.semanticCoverage.score < 6) {
      recommendations.push({
        priority: 'medium',
        category: 'semantic_seo',
        issue: 'Limited semantic keyword coverage',
        solution: 'Add more related terms and synonyms to content',
        keywords: keywordData.semanticKeywords || [],
        impact: 'Medium - Improves comprehensiveness and ranking for related terms'
      });
    }

    // Long-tail opportunities
    if (analysis.longTailOpportunities.score < 7) {
      recommendations.push({
        priority: 'medium',
        category: 'long_tail_optimization',
        issue: 'Underutilized long-tail keyword opportunities',
        solution: 'Create more specific, problem-solving content sections',
        keywords: keywordData.longTailKeywords?.slice(0, 5) || [],
        impact: 'Medium - Captures more specific search queries'
      });
    }

    // Question-based content
    if (keywordData.questionKeywords?.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'question_optimization',
        issue: 'Opportunity to capture question-based searches',
        solution: 'Add FAQ section or directly answer common questions',
        keywords: keywordData.questionKeywords.slice(0, 3),
        impact: 'Low-Medium - Improves voice search and featured snippet potential'
      });
    }

    return recommendations;
  }

  /**
   * Analyze competitive keywords for market insights
   */
  async analyzeCompetitiveKeywords(keywordData) {
    if (!keywordData.competitiveKeywords || keywordData.competitiveKeywords.length === 0) {
      return {
        opportunities: [],
        threats: [],
        recommendations: ['Generate competitive keywords for better market analysis']
      };
    }

    const prompt = `
Analyze these competitive keywords for market opportunities and threats:

Competitive Keywords: ${keywordData.competitiveKeywords.join(', ')}
Primary Keywords: ${keywordData.primaryKeywords?.join(', ') || 'None'}

Provide JSON analysis:
{
  "marketOpportunities": ["opportunity 1", "opportunity 2"],
  "competitiveThreats": ["threat 1", "threat 2"],
  "gapAnalysis": ["gap 1", "gap 2"],
  "strategicRecommendations": ["rec 1", "rec 2"]
}`;

    try {
      const completion = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive SEO analyst specializing in keyword gap analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.4
      });

      let responseText = completion.choices[0].message.content.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Competitive analysis failed:', error);
      return {
        marketOpportunities: ['Analyze competitor content for keyword gaps'],
        competitiveThreats: ['Monitor competitor keyword rankings'],
        gapAnalysis: ['Identify underserved keyword opportunities'],
        strategicRecommendations: ['Develop unique content angles']
      };
    }
  }

  /**
   * Calculate optimization score based on analysis
   */
  calculateOptimizationScore(analysis) {
    const weights = {
      keywordRelevance: 0.25,
      searchIntentAlignment: 0.25,
      semanticCoverage: 0.20,
      longTailOpportunities: 0.15,
      competitionAnalysis: 0.15
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      if (analysis[key] && typeof analysis[key].score === 'number') {
        totalScore += analysis[key].score * weight * 10; // Convert to 100-point scale
        totalWeight += weight;
      }
    });

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
    
    return {
      score: finalScore,
      grade: this.getGradeFromScore(finalScore),
      interpretation: this.interpretScore(finalScore)
    };
  }

  /**
   * Generate actionable steps from recommendations
   */
  generateActionableSteps(recommendations) {
    const highPriority = recommendations.filter(r => r.priority === 'high');
    const mediumPriority = recommendations.filter(r => r.priority === 'medium');
    const lowPriority = recommendations.filter(r => r.priority === 'low');

    return {
      immediate: highPriority.map(r => ({
        action: r.solution,
        keywords: r.keywords?.slice(0, 3) || [],
        impact: r.impact
      })),
      shortTerm: mediumPriority.map(r => ({
        action: r.solution,
        keywords: r.keywords?.slice(0, 3) || [],
        impact: r.impact
      })),
      longTerm: lowPriority.map(r => ({
        action: r.solution,
        keywords: r.keywords?.slice(0, 3) || [],
        impact: r.impact
      }))
    };
  }

  /**
   * Generate fallback analysis when AI analysis fails
   */
  generateFallbackAnalysis(keywordData) {
    const hasKeywords = keywordData.primaryKeywords && keywordData.primaryKeywords.length > 0;
    const hasLongTail = keywordData.longTailKeywords && keywordData.longTailKeywords.length > 0;
    const hasSemanticKeywords = keywordData.semanticKeywords && keywordData.semanticKeywords.length > 0;

    return {
      keywordRelevance: {
        score: hasKeywords ? 7 : 3,
        strengths: hasKeywords ? ['Keywords present'] : [],
        weaknesses: hasKeywords ? [] : ['No primary keywords generated']
      },
      searchIntentAlignment: {
        score: 6,
        primaryIntent: 'informational',
        intentMatch: true,
        recommendations: ['Review keyword intent alignment']
      },
      semanticCoverage: {
        score: hasSemanticKeywords ? 6 : 3,
        coverage: hasSemanticKeywords ? 'fair' : 'poor',
        missingTerms: ['Related terms needed']
      },
      longTailOpportunities: {
        score: hasLongTail ? 7 : 4,
        qualityAssessment: hasLongTail ? 'good' : 'fair',
        improvements: ['Add more specific long-tail keywords']
      },
      overallAssessment: {
        totalScore: hasKeywords ? 65 : 35,
        grade: hasKeywords ? 'C' : 'D',
        keyStrengths: hasKeywords ? ['Basic keyword coverage'] : [],
        criticalIssues: hasKeywords ? [] : ['Missing essential keywords']
      }
    };
  }

  /**
   * Helper methods
   */
  getGradeFromScore(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  interpretScore(score) {
    if (score >= 90) return 'Excellent keyword optimization with strong SEO potential';
    if (score >= 80) return 'Good keyword strategy with minor optimization opportunities';
    if (score >= 70) return 'Decent keyword foundation with room for improvement';
    if (score >= 60) return 'Basic keyword coverage with significant optimization needed';
    return 'Poor keyword strategy requiring major improvements';
  }

  /**
   * Generate keyword usage recommendations for different content sections
   */
  generateUsageRecommendations(keywordData, _contentType = 'youtube') {
    const recommendations = {
      title: {
        primary: keywordData.primaryKeywords?.slice(0, 2) || [],
        instructions: 'Include 1-2 primary keywords naturally, prioritize front-loading'
      },
      description: {
        primary: keywordData.primaryKeywords?.slice(0, 3) || [],
        secondary: keywordData.longTailKeywords?.slice(0, 2) || [],
        semantic: keywordData.semanticKeywords?.slice(0, 2) || [],
        instructions: 'Natural integration throughout, front-load primary keywords in first 125 characters'
      },
      tags: {
        keywords: [
          ...(keywordData.primaryKeywords || []),
          ...(keywordData.longTailKeywords?.slice(0, 5) || []),
          ...(keywordData.relatedTopics?.slice(0, 3) || [])
        ].slice(0, 15),
        instructions: 'Use exact keywords as tags, prioritize most relevant terms'
      },
      content: {
        primary: keywordData.primaryKeywords || [],
        semantic: keywordData.semanticKeywords || [],
        questions: keywordData.questionKeywords || [],
        instructions: 'Distribute throughout content naturally, maintain 2-3% keyword density'
      },
      hashtags: keywordData.trendingHashtags || []
    };

    return recommendations;
  }
}

export default KeywordAnalyzer;