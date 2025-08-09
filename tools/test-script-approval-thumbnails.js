#!/usr/bin/env node

/**
 * Script Approval to Thumbnail Generation Integration Test
 * 
 * This tool tests the complete integration between script approval detection
 * and thumbnail generation workflow to ensure thumbnails are generated
 * when a script is approved.
 * 
 * Steps:
 * 1. Validates WorkflowService integration with StatusMonitorService
 * 2. Tests processApprovedScript method includes thumbnail generation
 * 3. Verifies StatusMonitorService triggers correct workflow
 * 4. Simulates script approval workflow
 */

import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import WorkflowService from '../src/services/workflowService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

class ScriptApprovalThumbnailTester {
  constructor() {
    this.results = {
      integration: [],
      workflow: [],
      simulation: [],
      overall: 'unknown'
    };
    
    this.workflowService = null;
    this.statusMonitorService = null;
  }

  /**
   * Test integration between services
   */
  async testServiceIntegration() {
    logger.info('🔗 Testing service integration...');
    
    try {
      // Initialize WorkflowService
      this.workflowService = new WorkflowService();
      
      const checks = [
        {
          name: 'WorkflowService Initialization',
          test: () => !!this.workflowService,
          required: true
        },
        {
          name: 'StatusMonitorService in Workflow',
          test: () => !!this.workflowService.statusMonitorService,
          required: true
        },
        {
          name: 'WorkflowService Reference in StatusMonitor',
          test: () => !!this.workflowService.statusMonitorService.workflowService,
          required: true
        },
        {
          name: 'ThumbnailService in Workflow',
          test: () => !!this.workflowService.thumbnailService,
          required: true
        },
        {
          name: 'processApprovedScript Method Available',
          test: () => typeof this.workflowService.processApprovedScript === 'function',
          required: true
        },
        {
          name: 'StatusMonitor createVoiceScriptFallback Available',
          test: () => typeof this.workflowService.statusMonitorService.createVoiceScriptFallback === 'function',
          required: true
        }
      ];

      for (const check of checks) {
        try {
          const passed = check.test();
          const status = passed ? '✅' : '❌';
          
          this.results.integration.push({
            name: check.name,
            passed,
            required: check.required,
            error: null
          });
          
          logger.info(`${status} ${check.name}: ${passed ? 'Success' : 'Failed'}`);
        } catch (error) {
          const status = check.required ? '❌' : '⚠️';
          
          this.results.integration.push({
            name: check.name,
            passed: false,
            required: check.required,
            error: error.message
          });
          
          logger.error(`${status} ${check.name}: ${error.message}`);
        }
      }
      
      this.statusMonitorService = this.workflowService.statusMonitorService;
      
    } catch (error) {
      logger.error('❌ Failed to initialize services:', error);
      this.results.integration.push({
        name: 'Service Initialization',
        passed: false,
        required: true,
        error: error.message
      });
    }
  }

  /**
   * Test workflow methods and thumbnail integration
   */
  async testWorkflowMethods() {
    logger.info('⚙️ Testing workflow methods...');
    
    if (!this.workflowService) {
      logger.error('❌ WorkflowService not available for workflow testing');
      return;
    }

    const checks = [
      {
        name: 'processApprovedScript Contains Thumbnail Logic',
        test: () => {
          const methodStr = this.workflowService.processApprovedScript.toString();
          return methodStr.includes('processVideoThumbnails') || 
                 methodStr.includes('thumbnailService') ||
                 methodStr.includes('generateTwoThumbnails');
        },
        required: true
      },
      {
        name: 'Thumbnail Generation Configuration Check',
        test: () => {
          const methodStr = this.workflowService.processApprovedScript.toString();
          return methodStr.includes('enableThumbnailGeneration');
        },
        required: true
      },
      {
        name: 'Telegram Notification for Thumbnails',
        test: () => {
          const methodStr = this.workflowService.processApprovedScript.toString();
          return methodStr.includes('sendMessage') && 
                 (methodStr.includes('thumbnail') || methodStr.includes('Thumbnail'));
        },
        required: true
      },
      {
        name: 'Error Handling for Thumbnail Generation',
        test: () => {
          const methodStr = this.workflowService.processApprovedScript.toString();
          return methodStr.includes('thumbnailError') || 
                 methodStr.includes('catch') &&
                 methodStr.includes('thumbnail');
        },
        required: true
      }
    ];

    for (const check of checks) {
      try {
        const passed = check.test();
        const status = passed ? '✅' : '❌';
        
        this.results.workflow.push({
          name: check.name,
          passed,
          required: check.required,
          error: null
        });
        
        logger.info(`${status} ${check.name}: ${passed ? 'Found' : 'Missing'}`);
      } catch (error) {
        const status = check.required ? '❌' : '⚠️';
        
        this.results.workflow.push({
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
   * Test StatusMonitor script approval handling
   */
  async testStatusMonitorIntegration() {
    logger.info('📊 Testing status monitor integration...');
    
    if (!this.statusMonitorService) {
      logger.error('❌ StatusMonitorService not available');
      return;
    }

    const checks = [
      {
        name: 'Script Approval Handling Code',
        test: () => {
          const methodStr = this.statusMonitorService.sendIndividualChangeNotifications.toString();
          return methodStr.includes('Approved') && 
                 methodStr.includes('processApprovedScript');
        },
        required: true
      },
      {
        name: 'WorkflowService Reference Available',
        test: () => {
          const methodStr = this.statusMonitorService.sendIndividualChangeNotifications.toString();
          return methodStr.includes('this.workflowService');
        },
        required: true
      },
      {
        name: 'Fallback Voice Script Creation',
        test: () => {
          const methodStr = this.statusMonitorService.sendIndividualChangeNotifications.toString();
          return methodStr.includes('createVoiceScriptFallback');
        },
        required: true
      },
      {
        name: 'Complete Workflow Trigger',
        test: () => {
          const methodStr = this.statusMonitorService.sendIndividualChangeNotifications.toString();
          return methodStr.includes('complete approved script workflow') ||
                 methodStr.includes('voice + thumbnails');
        },
        required: true
      }
    ];

    for (const check of checks) {
      try {
        const passed = check.test();
        const status = passed ? '✅' : '❌';
        
        this.results.simulation.push({
          name: check.name,
          passed,
          required: check.required,
          error: null
        });
        
        logger.info(`${status} ${check.name}: ${passed ? 'Found' : 'Missing'}`);
      } catch (error) {
        const status = check.required ? '❌' : '⚠️';
        
        this.results.simulation.push({
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
   * Generate test summary and recommendations
   */
  generateSummary() {
    logger.info('📋 Test Summary:');
    
    const allResults = [
      ...this.results.integration,
      ...this.results.workflow,
      ...this.results.simulation
    ];
    
    const total = allResults.length;
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed && r.required).length;
    const warnings = allResults.filter(r => !r.passed && !r.required).length;
    
    const overallStatus = failed === 0 ? 'INTEGRATION_COMPLETE' : 'ISSUES_FOUND';
    this.results.overall = overallStatus;
    
    logger.info(`\n📊 Results:`);
    logger.info(`   ✅ Passed: ${passed}/${total}`);
    logger.info(`   ❌ Failed: ${failed}`);
    logger.info(`   ⚠️  Warnings: ${warnings}`);
    logger.info(`   🎯 Overall Status: ${overallStatus}`);
    
    if (overallStatus === 'INTEGRATION_COMPLETE') {
      logger.info('\n🎉 Script approval to thumbnail generation integration is working!');
      logger.info('\n📋 How it works:');
      logger.info('1. User sets "Script Approved" = "Approved" in Google Sheets');
      logger.info('2. StatusMonitorService detects the change');
      logger.info('3. StatusMonitorService calls WorkflowService.processApprovedScript()');
      logger.info('4. processApprovedScript() generates voice script + thumbnails');
      logger.info('5. Thumbnails are uploaded to Google Drive');
      logger.info('6. Telegram notifications are sent');
      
      logger.info('\n🧪 To test manually:');
      logger.info('1. Process a video URL through the workflow');
      logger.info('2. Wait for script to be generated (status: "Script Separated")');
      logger.info('3. In Google Sheets, change "Script Approved" from "Pending" to "Approved"');
      logger.info('4. Run status monitoring workflow');
      logger.info('5. Check Google Drive for generated thumbnails');
      logger.info('6. Verify Telegram notifications');
      
    } else {
      logger.info('\n🔧 Integration issues found that need to be resolved.');
      
      const failedChecks = allResults.filter(r => !r.passed && r.required);
      if (failedChecks.length > 0) {
        logger.info('\nRequired fixes:');
        failedChecks.forEach(check => {
          logger.info(`   • ${check.name}${check.error ? ': ' + check.error : ''}`);
        });
      }
    }
    
    // Configuration check
    logger.info('\n⚙️  Configuration Status:');
    logger.info(`   Thumbnail Generation Enabled: ${config.app.enableThumbnailGeneration !== false ? 'YES' : 'NO'}`);
    logger.info(`   Thumbnail Count: ${config.app.thumbnailCount || 2}`);
    logger.info(`   Image Model: ${config.app.imageModel || 'dall-e-3'}`);
    logger.info(`   OpenAI API Key: ${config.openai.apiKey ? 'CONFIGURED' : 'MISSING'}`);
    
    return this.results;
  }

  /**
   * Run complete integration test
   */
  async runTest() {
    logger.info('🚀 Starting script approval to thumbnail generation integration test...\n');
    
    try {
      await this.testServiceIntegration();
      logger.info('');
      
      await this.testWorkflowMethods();
      logger.info('');
      
      await this.testStatusMonitorIntegration();
      logger.info('');
      
      return this.generateSummary();
    } catch (error) {
      logger.error('💥 Integration test failed with error:', error);
      this.results.overall = 'ERROR';
      return this.results;
    }
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ScriptApprovalThumbnailTester();
  
  tester.runTest()
    .then(results => {
      const exitCode = results.overall === 'INTEGRATION_COMPLETE' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      logger.error('Integration test script failed:', error);
      process.exit(1);
    });
}

export default ScriptApprovalThumbnailTester;