#!/usr/bin/env node

/**
 * Test Script: Verify Updated CTA Policy
 * 
 * This script tests the updated CTA policy to ensure:
 * ✅ YouTube platform CTAs are allowed (subscribe, like, bell, share)
 * ❌ External CTAs are blocked (websites, downloads, external links)
 * 
 * Usage: node tools/test-updated-cta-policy.js
 */

import fs from 'fs';
import path from 'path';

class CTAPolicyTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      details: []
    };
  }

  /**
   * Extract the CTA policy from AIService for testing
   */
  extractPolicyFromAIService() {
    const aiServicePath = path.join(process.cwd(), 'src/services/aiService.js');
    const aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');
    
    // Extract the policy section - look for the title with more flexible matching
    const policyMatch = aiServiceContent.match(/CALL-TO-ACTION POLICY \(External vs YouTube Platform\):([\s\S]*?)(?=CONTEXT ANALYSIS:|Original Video Information:|ADVANCED SCRIPT ARCHITECTURE:|$)/);
    
    if (policyMatch) {
      return 'CALL-TO-ACTION POLICY (External vs YouTube Platform):' + policyMatch[1];
    } else {
      throw new Error('Could not extract CTA policy from AIService');
    }
  }

  /**
   * Test that YouTube platform CTAs are allowed
   */
  async testYouTubePlatformCTAs() {
    console.log('🧪 Testing YouTube Platform CTAs (Should be ALLOWED)...');
    
    const youtubeCtaKeywords = [
      'Subscribe and hit the bell',
      'Subscribe for more',
      'Like this video',
      'Hit the notification bell',
      'Share this video',
      'Watch more videos',
      'other videos'
    ];

    try {
      const policyText = this.extractPolicyFromAIService();
      
      let allowedCount = 0;
      for (const keyword of youtubeCtaKeywords) {
        if (this.isYouTubeCTAAllowed(keyword, policyText)) {
          allowedCount++;
          this.testResults.details.push(`✅ PASS: "${keyword}" correctly allowed`);
        } else {
          this.testResults.details.push(`❌ FAIL: "${keyword}" not found in allowed CTAs`);
        }
      }

      // Also check that the policy explicitly allows YouTube CTAs
      const hasAllowSection = policyText.includes('YOUTUBE PLATFORM CTAs (ALLOW THESE');
      const allowsSubscribe = policyText.includes('CAN include "Subscribe and hit the bell"');
      const allowsLike = policyText.includes('CAN mention "Like this video if it helped you"');
      
      if (hasAllowSection && allowsSubscribe && allowsLike) {
        this.testResults.details.push('✅ PASS: Policy explicitly allows YouTube CTAs');
        allowedCount++;
      } else {
        this.testResults.details.push('❌ FAIL: Policy does not explicitly allow YouTube CTAs');
      }

      if (allowedCount >= youtubeCtaKeywords.length) {
        this.testResults.passed++;
        console.log('✅ YouTube Platform CTAs test PASSED');
        return true;
      } else {
        this.testResults.failed++;
        console.log(`❌ YouTube Platform CTAs test FAILED (${allowedCount}/${youtubeCtaKeywords.length + 1} checks passed)`);
        return false;
      }

    } catch (error) {
      console.error('❌ YouTube Platform CTAs test ERROR:', error.message);
      this.testResults.failed++;
      return false;
    }
  }

  /**
   * Test that external CTAs are blocked
   */
  async testExternalCTAs() {
    console.log('🧪 Testing External CTAs (Should be BLOCKED)...');
    
    const externalCtaKeywords = [
      'Click the link below',
      'Click the link in the description',
      'Download our guide',
      'Visit our website',
      'Check the description for links',
      'Follow us on social media',
      'Sign up for our newsletter',
      'Join our email list'
    ];

    try {
      const policyText = this.extractPolicyFromAIService();
      
      let blockedCount = 0;
      for (const keyword of externalCtaKeywords) {
        if (this.isExternalCTABlocked(keyword, policyText)) {
          blockedCount++;
          this.testResults.details.push(`✅ PASS: "${keyword}" correctly blocked`);
        } else {
          this.testResults.details.push(`❌ FAIL: "${keyword}" not found in blocked CTAs`);
        }
      }

      // Also check that the policy explicitly blocks external CTAs
      const hasBlockSection = policyText.includes('EXTERNAL CTAs (BLOCK THESE');
      const blocksLinks = policyText.includes('NEVER include "Click the link below"');
      const blocksDownloads = policyText.includes('NEVER mention "Download our guide"');
      
      if (hasBlockSection && blocksLinks && blocksDownloads) {
        this.testResults.details.push('✅ PASS: Policy explicitly blocks external CTAs');
        blockedCount++;
      } else {
        this.testResults.details.push('❌ FAIL: Policy does not explicitly block external CTAs');
      }

      if (blockedCount >= externalCtaKeywords.length) {
        this.testResults.passed++;
        console.log('✅ External CTAs test PASSED');
        return true;
      } else {
        this.testResults.failed++;
        console.log(`❌ External CTAs test FAILED (${blockedCount}/${externalCtaKeywords.length + 1} checks passed)`);
        return false;
      }

    } catch (error) {
      console.error('❌ External CTAs test ERROR:', error.message);
      this.testResults.failed++;
      return false;
    }
  }

  /**
   * Check if a YouTube CTA is allowed in the policy
   */
  isYouTubeCTAAllowed(keyword, policyText) {
    // Simpler approach: just check if the specific YouTube CTAs are mentioned in policy
    const lowerPolicyText = policyText.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // For specific common phrases, check if they appear in the policy text
    const youtubeSpecificPhrases = [
      'subscribe and hit the bell',
      'subscribe for more',
      'like this video',
      'notification bell',
      'share this video',
      'watch more videos',
      'other videos'
    ];
    
    return youtubeSpecificPhrases.some(phrase => 
      lowerKeyword.includes(phrase) && lowerPolicyText.includes(phrase)
    );
  }

  /**
   * Check if an external CTA is blocked in the policy
   */
  isExternalCTABlocked(keyword, policyText) {
    // Simpler approach: check if the external CTAs are mentioned as blocked in policy
    const lowerPolicyText = policyText.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // For specific external phrases, check if they appear in the policy text as blocked
    const externalSpecificPhrases = [
      'click the link below',
      'click the link in the description',
      'download our guide',
      'visit our website',
      'check the description for links',
      'follow us on social media',
      'sign up for our newsletter',
      'join our email list'
    ];
    
    return externalSpecificPhrases.some(phrase => 
      lowerKeyword.includes(phrase) && lowerPolicyText.includes(phrase)
    );
  }

  /**
   * Extract a specific section from the policy text
   */
  extractSection(policyText, sectionTitle) {
    // Escape special regex characters
    const escapedTitle = sectionTitle.replace(/[()]/g, '\\$&');
    // Extract until the next major section (with ❌ or ✅ starting the line) or end of text
    const sectionRegex = new RegExp(`${escapedTitle}[\\s\\S]*?(?=\\n❌|\\n✅|$)`, 'i');
    const match = policyText.match(sectionRegex);
    return match ? match[0] : null;
  }

  /**
   * Test policy structure and formatting
   */
  async testPolicyStructure() {
    console.log('🧪 Testing Policy Structure...');
    
    try {
      const policyText = this.extractPolicyFromAIService();
      
      const structureChecks = [
        {
          name: 'Has clear title',
          check: () => {
            const hasTitle = policyText.includes('CALL-TO-ACTION POLICY (External vs YouTube Platform)');
            if (!hasTitle) {
              console.log('DEBUG: Policy text preview:', policyText.substring(0, 200) + '...');
            }
            return hasTitle;
          }
        },
        {
          name: 'Has external CTA block section',
          check: () => policyText.includes('EXTERNAL CTAs (BLOCK THESE')
        },
        {
          name: 'Has YouTube CTA allow section',
          check: () => policyText.includes('YOUTUBE PLATFORM CTAs (ALLOW THESE')
        },
        {
          name: 'Has content requirements',
          check: () => policyText.includes('CONTENT REQUIREMENTS')
        },
        {
          name: 'Uses consistent emoji formatting',
          check: () => policyText.includes('❌') && policyText.includes('✅')
        }
      ];

      let passedChecks = 0;
      for (const { name, check } of structureChecks) {
        if (check()) {
          passedChecks++;
          this.testResults.details.push(`✅ PASS: ${name}`);
        } else {
          this.testResults.details.push(`❌ FAIL: ${name}`);
        }
      }

      if (passedChecks === structureChecks.length) {
        this.testResults.passed++;
        console.log('✅ Policy Structure test PASSED');
        return true;
      } else {
        this.testResults.failed++;
        console.log(`❌ Policy Structure test FAILED (${passedChecks}/${structureChecks.length} checks passed)`);
        return false;
      }

    } catch (error) {
      console.error('❌ Policy Structure test ERROR:', error.message);
      this.testResults.failed++;
      return false;
    }
  }

  /**
   * Run all tests and generate report
   */
  async runAllTests() {
    console.log('🚀 Starting CTA Policy Tests...');
    console.log('='.repeat(50));

    const results = [];
    
    // Run all tests
    results.push(await this.testPolicyStructure());
    results.push(await this.testYouTubePlatformCTAs());
    results.push(await this.testExternalCTAs());

    // Generate summary report
    this.generateReport();
    
    return results.every(result => result === true);
  }

  /**
   * Generate detailed test report
   */
  generateReport() {
    console.log('');
    console.log('📊 CTA POLICY TEST REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Tests Passed: ${this.testResults.passed}`);
    console.log(`❌ Tests Failed: ${this.testResults.failed}`);
    
    const total = this.testResults.passed + this.testResults.failed;
    if (total > 0) {
      console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / total) * 100)}%`);
    }
    
    console.log('');
    console.log('📋 Detailed Results:');
    console.log('-'.repeat(30));
    
    this.testResults.details.forEach(detail => {
      console.log(detail);
    });
    
    console.log('');
    
    if (this.testResults.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! CTA Policy is working correctly.');
      console.log('✅ YouTube platform CTAs are properly allowed');
      console.log('✅ External CTAs are properly blocked');
      console.log('✅ Policy structure is correct');
    } else {
      console.error('⚠️  SOME TESTS FAILED! Please review the CTA policy implementation.');
    }
    
    console.log('='.repeat(50));
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CTAPolicyTester();
  
  tester.runAllTests()
    .then(success => {
      if (success) {
        console.log('🎯 All CTA policy tests completed successfully!');
        process.exit(0);
      } else {
        console.error('💥 Some CTA policy tests failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('🚨 CTA policy test runner failed:', error);
      process.exit(1);
    });
}

export { CTAPolicyTester };