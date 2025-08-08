// Metadata validation utilities

/**
 * MetadataValidator - Validates metadata integrity and completeness
 */
class MetadataValidator {
  
  /**
   * Validate that metadata contains all required fields
   */
  static validateRequiredFields(metadata) {
    const required = [
      'youtubeUrl',
      'title', 
      'videoId',
      'channelTitle',
      'duration'
    ];

    const missing = required.filter(field => !metadata[field]);
    
    return {
      isValid: missing.length === 0,
      missingFields: missing,
      message: missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : 'All required fields present'
    };
  }

  /**
   * Validate YouTube URL format
   */
  static validateYouTubeUrl(url) {
    if (!url) {
      return { isValid: false, message: 'YouTube URL is empty' };
    }

    const youtubeRegex = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;
    const isValid = youtubeRegex.test(url);
    
    return {
      isValid,
      message: isValid ? 'Valid YouTube URL' : 'Invalid YouTube URL format'
    };
  }

  /**
   * Validate video ID format (VID-XXXX)
   */
  static validateVideoId(videoId) {
    if (!videoId) {
      return { isValid: false, message: 'Video ID is empty' };
    }

    const vidRegex = /^VID-\d+$/;
    const isValid = vidRegex.test(videoId);
    
    return {
      isValid,
      message: isValid ? 'Valid video ID format' : 'Invalid video ID format (expected VID-XXXX)'
    };
  }

  /**
   * Validate duration format (ISO 8601)
   */
  static validateDuration(duration) {
    if (!duration) {
      return { isValid: false, message: 'Duration is empty' };
    }

    // ISO 8601 duration format: PT4M13S
    const durationRegex = /^PT(\d+H)?(\d+M)?(\d+S)?$/;
    const isValid = durationRegex.test(duration);
    
    return {
      isValid,
      message: isValid ? 'Valid ISO 8601 duration' : 'Invalid duration format (expected ISO 8601: PT4M13S)'
    };
  }

  /**
   * Validate metadata completeness and format
   */
  static validateMetadata(metadata) {
    const validations = {
      requiredFields: this.validateRequiredFields(metadata),
      youtubeUrl: this.validateYouTubeUrl(metadata.youtubeUrl),
      videoId: this.validateVideoId(metadata.videoId),
      duration: this.validateDuration(metadata.duration)
    };

    const errors = [];
    const warnings = [];

    // Collect all validation errors
    Object.entries(validations).forEach(([key, validation]) => {
      if (!validation.isValid) {
        errors.push(`${key}: ${validation.message}`);
      }
    });

    // Additional warnings for optional but important fields
    if (!metadata.description) warnings.push('Description is missing');
    if (!metadata.thumbnails) warnings.push('Thumbnails are missing');  
    if (!metadata.transcript) warnings.push('Transcript is missing');
    if (!metadata.viewCount) warnings.push('View count is missing');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validations,
      summary: `${errors.length} errors, ${warnings.length} warnings`
    };
  }

  /**
   * Validate metadata record structure (full record with system fields)
   */
  static validateMetadataRecord(record) {
    if (!record) {
      return { isValid: false, message: 'Metadata record is null/undefined' };
    }

    const requiredRecordFields = [
      'videoId',
      'version', 
      'createdAt',
      'originalMetadata',
      'workflowMetadata',
      'systemIntegrity'
    ];

    const missing = requiredRecordFields.filter(field => !record[field]);
    if (missing.length > 0) {
      return { 
        isValid: false, 
        message: `Invalid metadata record structure. Missing: ${missing.join(', ')}` 
      };
    }

    // Validate the original metadata within the record
    const metadataValidation = this.validateMetadata(record.originalMetadata);
    
    return {
      isValid: metadataValidation.isValid,
      metadataValidation,
      message: metadataValidation.isValid ? 'Valid metadata record' : `Invalid metadata: ${metadataValidation.errors.join('; ')}`
    };
  }

  /**
   * Compare two metadata objects and find discrepancies
   */
  static compareMetadata(original, current, fieldsToCompare = null) {
    const defaultFields = ['youtubeUrl', 'title', 'videoId', 'channelTitle', 'duration', 'viewCount'];
    const fields = fieldsToCompare || defaultFields;
    
    const discrepancies = [];

    fields.forEach(field => {
      const originalValue = original[field];
      const currentValue = current[field];
      
      if (originalValue !== currentValue) {
        discrepancies.push({
          field,
          original: originalValue,
          current: currentValue,
          severity: this.getFieldSeverity(field)
        });
      }
    });

    return {
      hasDiscrepancies: discrepancies.length > 0,
      discrepancies,
      summary: `${discrepancies.length} field discrepancies found`,
      criticalIssues: discrepancies.filter(d => d.severity === 'critical').length,
      warningIssues: discrepancies.filter(d => d.severity === 'warning').length
    };
  }

  /**
   * Determine severity level for field discrepancies
   */
  static getFieldSeverity(field) {
    const criticalFields = ['youtubeUrl', 'videoId', 'youtubeVideoId'];
    const warningFields = ['title', 'channelTitle', 'duration'];
    
    if (criticalFields.includes(field)) return 'critical';
    if (warningFields.includes(field)) return 'warning';
    return 'info';
  }

  /**
   * Generate validation report for multiple videos
   */
  static generateValidationReport(metadataRecords) {
    const report = {
      totalVideos: metadataRecords.length,
      validVideos: 0,
      invalidVideos: 0,
      errors: [],
      warnings: [],
      summary: {}
    };

    metadataRecords.forEach((record, index) => {
      const validation = this.validateMetadataRecord(record);
      
      if (validation.isValid) {
        report.validVideos++;
      } else {
        report.invalidVideos++;
        report.errors.push({
          index,
          videoId: record.videoId || `Record ${index}`,
          message: validation.message,
          details: validation.metadataValidation
        });
      }
    });

    report.summary = {
      validationRate: ((report.validVideos / report.totalVideos) * 100).toFixed(1) + '%',
      errorRate: ((report.invalidVideos / report.totalVideos) * 100).toFixed(1) + '%'
    };

    return report;
  }
}

export default MetadataValidator;