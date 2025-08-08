import logger from '../utils/logger.js';

/**
 * Enhanced Keyword Analyzer for YouTube Content Optimization
 * Provides advanced keyword analysis and optimization recommendations
 * Based on SEO specialist and YouTube growth strategist recommendations
 */
class EnhancedKeywordAnalyzer {
  constructor() {
    this.performanceMetrics = {
      ctr: 0,
      watchTime: 0,
      engagement: 0,
      retention: 0
    };
  }

  /**
   * Analyze keyword performance potential for YouTube algorithm
   * @param {Object} keywordData - Complete keyword research data
   * @param {Object} videoMetadata - Video metadata and content info
   * @returns {Object} Performance analysis and recommendations
   */
  analyzeKeywordPerformance(keywordData, _videoMetadata) {
    try {
      const analysis = {
        algorithmOptimization: this.analyzeAlgorithmPotential(keywordData),
        competitiveAnalysis: this.analyzeCompetitiveGaps(keywordData),
        engagementPotential: this.analyzeEngagementTriggers(keywordData),
        searchIntentMapping: this.mapSearchIntents(keywordData),
        platformOptimization: this.analyzePlatformSpecific(keywordData),
        recommendations: []
      };

      // Generate specific recommendations
      analysis.recommendations = this.generateOptimizationRecommendations(analysis, keywordData);

      logger.info('Keyword performance analysis completed');
      return analysis;

    } catch (error) {
      logger.error('Error analyzing keyword performance:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Analyze algorithm optimization potential
   */
  analyzeAlgorithmPotential(keywordData) {
    const algorithmScore = this.calculateAlgorithmScore({
      youtubeSearch: keywordData.youtubeSearchKeywords?.length || 0,
      browseFeed: keywordData.browseFeedKeywords?.length || 0,
      shorts: keywordData.shortsOptimizedKeywords?.length || 0,
      engagement: keywordData.engagementTriggerKeywords?.length || 0,
      retention: keywordData.retentionKeywords?.length || 0
    });

    return {
      score: algorithmScore,
      strengths: this.identifyAlgorithmStrengths(keywordData),
      weaknesses: this.identifyAlgorithmWeaknesses(keywordData),
      optimizationPotential: algorithmScore < 70 ? 'high' : algorithmScore < 85 ? 'medium' : 'low'
    };
  }

  /**
   * Calculate algorithm optimization score
   */
  calculateAlgorithmScore(counts) {
    const weights = {
      youtubeSearch: 20,
      browseFeed: 15,
      shorts: 20,
      engagement: 25,
      retention: 20
    };

    let score = 0;
    Object.keys(weights).forEach(key => {
      const normalized = Math.min(counts[key] / 6, 1); // Normalize to expected count
      score += weights[key] * normalized;
    });

    return Math.round(score);
  }

  /**
   * Identify algorithm optimization strengths
   */
  identifyAlgorithmStrengths(keywordData) {
    const strengths = [];
    
    if ((keywordData.youtubeSearchKeywords?.length || 0) >= 6) {
      strengths.push('Strong YouTube search optimization');
    }
    if ((keywordData.engagementTriggerKeywords?.length || 0) >= 4) {
      strengths.push('Excellent engagement trigger potential');
    }
    if ((keywordData.retentionKeywords?.length || 0) >= 4) {
      strengths.push('Strong retention optimization');
    }
    if ((keywordData.shortsOptimizedKeywords?.length || 0) >= 5) {
      strengths.push('Comprehensive Shorts optimization');
    }

    return strengths;
  }

  /**
   * Identify algorithm optimization weaknesses
   */
  identifyAlgorithmWeaknesses(keywordData) {
    const weaknesses = [];
    
    if ((keywordData.youtubeSearchKeywords?.length || 0) < 4) {
      weaknesses.push('Insufficient YouTube search keywords');
    }
    if ((keywordData.browseFeedKeywords?.length || 0) < 3) {
      weaknesses.push('Limited browse feed optimization');
    }
    if ((keywordData.engagementTriggerKeywords?.length || 0) < 3) {
      weaknesses.push('Weak engagement trigger potential');
    }
    if ((keywordData.retentionKeywords?.length || 0) < 3) {
      weaknesses.push('Limited retention optimization');
    }

    return weaknesses;
  }

  /**
   * Analyze competitive keyword gaps
   */
  analyzeCompetitiveGaps(keywordData) {
    const competitiveKeywords = keywordData.competitiveKeywords || [];
    const primaryKeywords = keywordData.primaryKeywords || [];
    
    return {
      gapOpportunities: competitiveKeywords.length,
      competitionLevel: this.assessCompetitionLevel(primaryKeywords, competitiveKeywords),
      marketPosition: competitiveKeywords.length > 3 ? 'opportunity-rich' : 'competitive',
      recommendations: this.generateCompetitiveRecommendations(competitiveKeywords)
    };
  }

  /**
   * Assess overall competition level
   */
  assessCompetitionLevel(primary, competitive) {
    if (competitive.length > primary.length * 0.5) {
      return 'high-opportunity';
    } else if (competitive.length > 2) {
      return 'moderate';
    } else {
      return 'highly-competitive';
    }
  }

  /**
   * Generate competitive recommendations
   */
  generateCompetitiveRecommendations(competitiveKeywords) {
    const recommendations = [];
    
    if (competitiveKeywords.length > 4) {
      recommendations.push('Excellent gap opportunities - focus on competitive keywords');
    } else if (competitiveKeywords.length > 2) {
      recommendations.push('Good niche opportunities available');
    } else {
      recommendations.push('Consider exploring adjacent topics for better opportunities');
    }

    return recommendations;
  }

  /**
   * Analyze engagement trigger potential
   */
  analyzeEngagementTriggers(keywordData) {
    const engagementKeywords = keywordData.engagementTriggerKeywords || [];
    const questionKeywords = keywordData.questionKeywords || [];
    
    const engagementScore = this.calculateEngagementScore(engagementKeywords, questionKeywords);
    
    return {
      score: engagementScore,
      triggerCount: engagementKeywords.length,
      questionCount: questionKeywords.length,
      potential: engagementScore > 75 ? 'high' : engagementScore > 50 ? 'medium' : 'low',
      recommendations: this.generateEngagementRecommendations(engagementScore)
    };
  }

  /**
   * Calculate engagement potential score
   */
  calculateEngagementScore(engagement, questions) {
    const engagementWeight = 60;
    const questionWeight = 40;
    
    const engagementScore = Math.min(engagement.length / 4, 1) * engagementWeight;
    const questionScore = Math.min(questions.length / 6, 1) * questionWeight;
    
    return Math.round(engagementScore + questionScore);
  }

  /**
   * Generate engagement optimization recommendations
   */
  generateEngagementRecommendations(score) {
    const recommendations = [];
    
    if (score > 75) {
      recommendations.push('Excellent engagement potential - leverage trigger keywords prominently');
    } else if (score > 50) {
      recommendations.push('Good engagement foundation - consider adding more trigger words');
    } else {
      recommendations.push('Low engagement potential - prioritize discussion-starting keywords');
    }

    return recommendations;
  }

  /**
   * Map search intents to keyword categories
   */
  mapSearchIntents(keywordData) {
    return {
      informational: {
        keywords: [
          ...(keywordData.questionKeywords || []),
          ...(keywordData.relatedTopics || [])
        ],
        strength: this.assessIntentStrength('informational', keywordData)
      },
      transactional: {
        keywords: keywordData.competitiveKeywords || [],
        strength: this.assessIntentStrength('transactional', keywordData)
      },
      navigational: {
        keywords: keywordData.youtubeSearchKeywords || [],
        strength: this.assessIntentStrength('navigational', keywordData)
      },
      commercial: {
        keywords: keywordData.primaryKeywords || [],
        strength: this.assessIntentStrength('commercial', keywordData)
      }
    };
  }

  /**
   * Assess search intent strength
   */
  assessIntentStrength(intent, keywordData) {
    const intentKeywordCounts = {
      informational: (keywordData.questionKeywords?.length || 0) + (keywordData.relatedTopics?.length || 0),
      transactional: keywordData.competitiveKeywords?.length || 0,
      navigational: keywordData.youtubeSearchKeywords?.length || 0,
      commercial: keywordData.primaryKeywords?.length || 0
    };

    const count = intentKeywordCounts[intent] || 0;
    
    if (count > 6) return 'strong';
    if (count > 3) return 'moderate';
    return 'weak';
  }

  /**
   * Analyze platform-specific optimization
   */
  analyzePlatformSpecific(keywordData) {
    return {
      youtube: {
        searchOptimized: keywordData.youtubeSearchKeywords?.length || 0,
        browseOptimized: keywordData.browseFeedKeywords?.length || 0,
        shortsOptimized: keywordData.shortsOptimizedKeywords?.length || 0,
        score: this.calculatePlatformScore('youtube', keywordData)
      },
      google: {
        semanticOptimized: keywordData.semanticKeywords?.length || 0,
        longTailOptimized: keywordData.longTailKeywords?.length || 0,
        score: this.calculatePlatformScore('google', keywordData)
      },
      social: {
        hashtagOptimized: keywordData.trendingHashtags?.length || 0,
        engagementOptimized: keywordData.engagementTriggerKeywords?.length || 0,
        score: this.calculatePlatformScore('social', keywordData)
      }
    };
  }

  /**
   * Calculate platform-specific optimization score
   */
  calculatePlatformScore(platform, keywordData) {
    const platformMetrics = {
      youtube: {
        search: keywordData.youtubeSearchKeywords?.length || 0,
        browse: keywordData.browseFeedKeywords?.length || 0,
        shorts: keywordData.shortsOptimizedKeywords?.length || 0,
        weights: { search: 40, browse: 30, shorts: 30 }
      },
      google: {
        semantic: keywordData.semanticKeywords?.length || 0,
        longTail: keywordData.longTailKeywords?.length || 0,
        weights: { semantic: 50, longTail: 50 }
      },
      social: {
        hashtags: keywordData.trendingHashtags?.length || 0,
        engagement: keywordData.engagementTriggerKeywords?.length || 0,
        weights: { hashtags: 40, engagement: 60 }
      }
    };

    const metrics = platformMetrics[platform];
    if (!metrics) return 0;

    let score = 0;
    Object.keys(metrics.weights).forEach(key => {
      const count = metrics[key] || 0;
      const expectedCount = platform === 'youtube' ? 6 : platform === 'google' ? 10 : 5;
      const normalized = Math.min(count / expectedCount, 1);
      score += metrics.weights[key] * normalized;
    });

    return Math.round(score);
  }

  /**
   * Generate comprehensive optimization recommendations
   */
  generateOptimizationRecommendations(analysis, _keywordData) {
    const recommendations = [];

    // Algorithm optimization recommendations
    if (analysis.algorithmOptimization.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'Algorithm Optimization',
        action: 'Enhance YouTube-specific keywords',
        details: analysis.algorithmOptimization.weaknesses
      });
    }

    // Engagement recommendations
    if (analysis.engagementPotential.score < 60) {
      recommendations.push({
        priority: 'high',
        category: 'Engagement Optimization',
        action: 'Add more engagement trigger keywords',
        details: ['Focus on discussion-starting terms', 'Include more question-based keywords']
      });
    }

    // Platform-specific recommendations
    Object.keys(analysis.platformOptimization).forEach(platform => {
      const platformData = analysis.platformOptimization[platform];
      if (platformData.score < 60) {
        recommendations.push({
          priority: 'medium',
          category: `${platform.toUpperCase()} Optimization`,
          action: `Improve ${platform} keyword strategy`,
          details: [`Current score: ${platformData.score}%`, 'Consider adding platform-specific keywords']
        });
      }
    });

    return recommendations;
  }

  /**
   * Get default analysis for error cases
   */
  getDefaultAnalysis() {
    return {
      algorithmOptimization: {
        score: 0,
        strengths: [],
        weaknesses: ['Analysis failed - unable to assess'],
        optimizationPotential: 'unknown'
      },
      competitiveAnalysis: {
        gapOpportunities: 0,
        competitionLevel: 'unknown',
        marketPosition: 'unknown',
        recommendations: []
      },
      engagementPotential: {
        score: 0,
        triggerCount: 0,
        questionCount: 0,
        potential: 'unknown',
        recommendations: []
      },
      searchIntentMapping: {},
      platformOptimization: {},
      recommendations: [{
        priority: 'high',
        category: 'System Error',
        action: 'Retry keyword analysis',
        details: ['Keyword analysis failed - please regenerate keywords']
      }]
    };
  }
}

export default EnhancedKeywordAnalyzer;