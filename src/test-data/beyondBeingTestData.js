/**
 * BeyondBeing Channel Test Data
 * Centralized test data for consistent testing across all test files
 * Based on actual channel statistics and video metadata
 */

// Load the actual test data from JSON files
import fs from 'fs';
import path from 'path';

const loadTestData = () => {
  try {
    const dataPath = path.join(process.cwd(), 'test_data_top10_videos.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(rawData);
  } catch {
    // Could not load test data from JSON file, using fallback data
    return null;
  }
};

const testDataJSON = loadTestData();

// Channel information
export const CHANNEL_INFO = {
  name: 'BeyondBeing',
  channelTitle: 'BeyondBeing',
  totalVideosAnalyzed: testDataJSON?.totalVideosAnalyzed || 26,
  extractedAt: testDataJSON?.extractedAt || '2025-08-06T05:34:07.102Z'
};

// Video test data - ranked by view count (most popular first)
export const TEST_VIDEOS = testDataJSON?.topVideos || [
  {
    rank: 1,
    title: 'The Art of Doing Anything Exceptionally Well ( even if you are not pro )',
    youtubeUrl: 'https://youtube.com/watch?v=r4IQopBxzOo',
    videoId: 'r4IQopBxzOo',
    viewCount: 766924,
    duration: '1:27',
    publishedDate: '2025-04-20',
    channelName: 'BeyondBeing',
    category: 'high-performance' // Most viewed - good for success testing
  },
  {
    rank: 2,
    title: 'How to Control your Brain ( before it\'s TOO late )',
    youtubeUrl: 'https://youtube.com/watch?v=H67kfrqHP2A',
    videoId: 'H67kfrqHP2A',
    viewCount: 280437,
    duration: '1:25',
    publishedDate: '2025-05-23',
    channelName: 'BeyondBeing',
    category: 'brain-control' // Second most viewed - good for metadata testing
  },
  {
    rank: 3,
    title: 'The Art Of Making A Plan ( That Actually Works )',
    youtubeUrl: 'https://youtube.com/watch?v=yIarDv9G7JM',
    videoId: 'yIarDv9G7JM',
    viewCount: 211980,
    duration: '1:35',
    publishedDate: '2025-07-02',
    channelName: 'BeyondBeing',
    category: 'planning' // Recent video - good for transcript testing
  },
  {
    rank: 4,
    title: 'How to Enter Flow State in 2 Minutes ( Do This Before You Work )',
    youtubeUrl: 'https://youtube.com/watch?v=jmAiIhkxMiI',
    videoId: 'jmAiIhkxMiI',
    viewCount: 203398,
    duration: '1:41',
    publishedDate: '2025-05-01',
    channelName: 'BeyondBeing',
    category: 'flow-state' // Longer duration - good for workflow testing
  },
  {
    rank: 5,
    title: 'How to Outgrow Everyone Around ( Even the older Generation )',
    youtubeUrl: 'https://youtube.com/watch?v=9KaKhbzBg3c',
    videoId: '9KaKhbzBg3c',
    viewCount: 61171,
    duration: '1:02',
    publishedDate: '2025-05-16',
    channelName: 'BeyondBeing',
    category: 'personal-growth' // Shorter video - good for quick testing
  }
];

// Categorized test URLs for specific scenarios
export const TEST_URLS = {
  // Most reliable for success testing (highest views)
  RELIABLE: TEST_VIDEOS[0].youtubeUrl, // 766K views
  
  // Good for metadata testing (second highest views)  
  METADATA_TESTING: TEST_VIDEOS[1].youtubeUrl, // 280K views
  
  // Recent video for transcript testing
  TRANSCRIPT_TESTING: TEST_VIDEOS[2].youtubeUrl, // July 2025
  
  // Longer video for workflow testing
  WORKFLOW_TESTING: TEST_VIDEOS[3].youtubeUrl, // 1:41 duration
  
  // Quick testing (shortest duration)
  QUICK_TESTING: TEST_VIDEOS[4].youtubeUrl, // 1:02 duration
  
  // All URLs for batch testing
  ALL: TEST_VIDEOS.map(v => v.youtubeUrl),
  
  // Top 3 for multiple testing
  TOP_3: TEST_VIDEOS.slice(0, 3).map(v => v.youtubeUrl),
  
  // Video IDs only
  VIDEO_IDS: TEST_VIDEOS.map(v => v.videoId)
};

// Expected metadata for validation testing
export const EXPECTED_METADATA = {
  [TEST_VIDEOS[0].videoId]: {
    title: TEST_VIDEOS[0].title,
    channelTitle: 'BeyondBeing',
    duration: '1:27',
    viewCount: 766924,
    publishedDate: '2025-04-20'
  },
  [TEST_VIDEOS[1].videoId]: {
    title: TEST_VIDEOS[1].title,
    channelTitle: 'BeyondBeing', 
    duration: '1:25',
    viewCount: 280437,
    publishedDate: '2025-05-23'
  },
  [TEST_VIDEOS[2].videoId]: {
    title: TEST_VIDEOS[2].title,
    channelTitle: 'BeyondBeing',
    duration: '1:35', 
    viewCount: 211980,
    publishedDate: '2025-07-02'
  }
};

// Test scenarios for different testing needs
export const TEST_SCENARIOS = {
  BASIC_URL_PARSING: {
    name: 'Basic URL parsing and video ID extraction',
    urls: [
      TEST_VIDEOS[0].youtubeUrl, // Standard format
      `https://youtu.be/${TEST_VIDEOS[1].videoId}`, // Short format
      `${TEST_VIDEOS[2].youtubeUrl}&list=123`, // With playlist
      TEST_VIDEOS[3].videoId // Already a video ID
    ]
  },
  
  METADATA_VALIDATION: {
    name: 'Metadata extraction and validation',
    videos: TEST_VIDEOS.slice(0, 3), // Top 3 videos
    expectedChannel: 'BeyondBeing'
  },
  
  TRANSCRIPT_FALLBACK: {
    name: 'Transcript extraction with fallbacks',
    videos: [
      {
        name: 'High-view video (likely has transcript)',
        url: TEST_VIDEOS[0].youtubeUrl,
        expectedSources: ['youtube']
      },
      {
        name: 'Recent video (may need fallback)',
        url: TEST_VIDEOS[2].youtubeUrl,
        expectedSources: ['youtube', 'description']
      },
      {
        name: 'Short video (may need alternative methods)',
        url: TEST_VIDEOS[4].youtubeUrl,
        expectedSources: ['youtube', 'alternative-libs', 'description']
      }
    ]
  },
  
  WORKFLOW_TESTING: {
    name: 'Complete workflow testing',
    primaryUrl: TEST_VIDEOS[0].youtubeUrl, // Most reliable
    backupUrl: TEST_VIDEOS[1].youtubeUrl,  // Second choice
    quickTestUrl: TEST_VIDEOS[4].youtubeUrl // For quick tests
  }
};

// Utility functions for test data
export const getVideoById = (videoId) => {
  return TEST_VIDEOS.find(v => v.videoId === videoId);
};

export const getVideoByUrl = (url) => {
  return TEST_VIDEOS.find(v => v.youtubeUrl === url);
};

export const getVideosByCategory = (category) => {
  return TEST_VIDEOS.filter(v => v.category === category);
};

export const getRandomTestVideo = () => {
  return TEST_VIDEOS[Math.floor(Math.random() * TEST_VIDEOS.length)];
};

export const getTopNVideos = (n = 3) => {
  return TEST_VIDEOS.slice(0, n);
};

// Export for backward compatibility
export default {
  CHANNEL_INFO,
  TEST_VIDEOS,
  TEST_URLS,
  EXPECTED_METADATA,
  TEST_SCENARIOS,
  getVideoById,
  getVideoByUrl,
  getVideosByCategory,
  getRandomTestVideo,
  getTopNVideos
};