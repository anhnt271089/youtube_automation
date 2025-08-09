#!/usr/bin/env node

/**
 * Thumbnail Generation Integration Validator
 * 
 * This tool validates that all components for thumbnail generation are properly integrated:
 * - ThumbnailService can be instantiated
 * - Required dependencies are available
 * - Configuration is properly set up
 * - File structure is ready for testing
 */

import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';

class ThumbnailIntegrationValidator {
  constructor() {
    this.results = {
      configuration: [],
      dependencies: [],
      services: [],
      overall: 'unknown'
    };
  }

  /**
   * Validate configuration settings
   */
  validateConfiguration() {
    logger.info('🔧 Validating configuration...');
    
    const checks = [
      {
        name: 'Thumbnail Generation Enabled',
        check: () => config.app.enableThumbnailGeneration !== false,
        value: config.app.enableThumbnailGeneration,
        required: false
      },
      {
        name: 'Thumbnail Count Setting',
        check: () => config.app.thumbnailCount >= 1 && config.app.thumbnailCount <= 5,
        value: config.app.thumbnailCount,
        required: false
      },
      {
        name: 'OpenAI API Key',
        check: () => !!config.openai.apiKey,
        value: config.openai.apiKey ? '[CONFIGURED]' : '[MISSING]',
        required: true
      },
      {
        name: 'Image Model Setting',
        check: () => config.app.imageModel && ['dall-e-2', 'dall-e-3'].includes(config.app.imageModel),
        value: config.app.imageModel,
        required: true
      },
      {
        name: 'Google Drive Folder ID',
        check: () => !!config.google.driveFolderId,
        value: config.google.driveFolderId ? '[CONFIGURED]' : '[MISSING]',
        required: true
      },
      {
        name: 'Google OAuth Tokens',
        check: () => !!config.google.accessToken && !!config.google.refreshToken,
        value: (config.google.accessToken && config.google.refreshToken) ? '[CONFIGURED]' : '[MISSING]',
        required: true
      }
    ];

    for (const check of checks) {
      const passed = check.check();
      const status = passed ? '✅' : (check.required ? '❌' : '⚠️');
      
      this.results.configuration.push({
        name: check.name,
        passed,
        required: check.required,
        value: check.value
      });
      
      logger.info(`${status} ${check.name}: ${check.value}`);
    }
  }

  /**
   * Validate service dependencies
   */
  async validateDependencies() {
    logger.info('📦 Validating service dependencies...');
    
    const checks = [
      {
        name: 'AIService Instantiation',
        test: () => new AIService(),
        required: true
      },
      {
        name: 'GoogleDriveService Instantiation', 
        test: () => new GoogleDriveService(),
        required: true
      },
      {
        name: 'ThumbnailService Instantiation',
        test: () => {
          const aiService = new AIService();
          const driveService = new GoogleDriveService();
          return new ThumbnailService(aiService, driveService);
        },
        required: true
      }
    ];

    for (const check of checks) {
      try {
        const service = check.test();
        const passed = !!service;
        const status = passed ? '✅' : '❌';
        
        this.results.dependencies.push({
          name: check.name,
          passed,
          required: check.required,
          error: null
        });
        
        logger.info(`${status} ${check.name}: Success`);
      } catch (error) {
        const status = check.required ? '❌' : '⚠️';
        
        this.results.dependencies.push({
          name: check.name,
          passed: false,
          required: check.required,
          error: error.message
        });
        
        logger.error(`${status} ${check.name}: ${error.message}`);
      }
    }
  }

  /**
   * Validate service methods and capabilities
   */
  async validateServiceMethods() {
    logger.info('🔍 Validating service methods...');
    
    try {
      const aiService = new AIService();
      const driveService = new GoogleDriveService();
      const thumbnailService = new ThumbnailService(aiService, driveService);
      
      const checks = [
        {
          name: 'ThumbnailService.generateThumbnailContext',
          test: () => typeof thumbnailService.generateThumbnailContext === 'function',
          required: true
        },
        {
          name: 'ThumbnailService.generateSingleThumbnail',
          test: () => typeof thumbnailService.generateSingleThumbnail === 'function',
          required: true
        },
        {
          name: 'ThumbnailService.processVideoThumbnails',
          test: () => typeof thumbnailService.processVideoThumbnails === 'function',
          required: true
        },
        {
          name: 'GoogleDriveService.sanitizeFolderName',
          test: () => typeof driveService.sanitizeFolderName === 'function',
          required: true
        },
        {
          name: 'AIService.generateImage',
          test: () => typeof aiService.generateImage === 'function',
          required: true
        },
        {
          name: 'ThumbnailService Style Templates',
          test: () => thumbnailService.thumbnailStyles && 
                      Object.keys(thumbnailService.thumbnailStyles).length >= 2,
          required: true
        }
      ];

      for (const check of checks) {
        try {
          const passed = check.test();
          const status = passed ? '✅' : '❌';
          
          this.results.services.push({
            name: check.name,
            passed,
            required: check.required,
            error: null
          });
          
          logger.info(`${status} ${check.name}: ${passed ? 'Available' : 'Missing'}`);
        } catch (error) {
          const status = check.required ? '❌' : '⚠️';
          
          this.results.services.push({
            name: check.name,
            passed: false,
            required: check.required,
            error: error.message
          });
          
          logger.error(`${status} ${check.name}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('❌ Failed to initialize services for method validation:', error);
    }
  }

  /**
   * Generate validation summary
   */
  generateSummary() {
    logger.info('📋 Validation Summary:');
    
    const allResults = [
      ...this.results.configuration,
      ...this.results.dependencies, 
      ...this.results.services
    ];
    
    const total = allResults.length;
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed && r.required).length;
    const warnings = allResults.filter(r => !r.passed && !r.required).length;
    
    const overallStatus = failed === 0 ? 'READY' : 'ISSUES_FOUND';
    this.results.overall = overallStatus;
    
    logger.info(`\n📊 Results:`);
    logger.info(`   ✅ Passed: ${passed}/${total}`);
    logger.info(`   ❌ Failed: ${failed}`);
    logger.info(`   ⚠️  Warnings: ${warnings}`);
    logger.info(`   🎯 Overall Status: ${overallStatus}`);
    
    if (overallStatus === 'READY') {
      logger.info('\n🎉 Thumbnail generation system is ready for production!');
      logger.info('\nNext steps:');
      logger.info('1. Process a video URL through the workflow');
      logger.info('2. Check Google Drive for generated thumbnails');
      logger.info('3. Monitor Telegram notifications');
      logger.info('4. Verify Google Sheets status tracking');
    } else {
      logger.info('\n🔧 Please resolve the failed checks before using thumbnail generation.');
      
      const failedChecks = allResults.filter(r => !r.passed && r.required);
      if (failedChecks.length > 0) {
        logger.info('\nRequired fixes:');
        failedChecks.forEach(check => {
          logger.info(`   • ${check.name}${check.error ? ': ' + check.error : ''}`);
        });
      }
    }
    
    return this.results;
  }

  /**
   * Run complete validation
   */
  async runValidation() {
    logger.info('🚀 Starting thumbnail generation integration validation...\n');
    
    try {
      this.validateConfiguration();
      logger.info('');
      
      await this.validateDependencies();
      logger.info('');
      
      await this.validateServiceMethods();
      logger.info('');
      
      return this.generateSummary();
    } catch (error) {
      logger.error('💥 Validation failed with error:', error);
      this.results.overall = 'ERROR';
      return this.results;
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ThumbnailIntegrationValidator();
  
  validator.runValidation()
    .then(results => {
      const exitCode = results.overall === 'READY' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      logger.error('Validation script failed:', error);
      process.exit(1);
    });
}

export default ThumbnailIntegrationValidator;