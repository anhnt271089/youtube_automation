# New Two-Database Notion Structure

## Database 1: Videos (Main Database)
**Purpose**: Clean overview of all videos and their processing status

### Properties:
- **VideoID** (Formula) - `id()` - Unique identifier  
- **Title** (Title) - Video title from YouTube
- **YouTube URL** (URL) - Source video URL  
- **Status** (Select) - Processing status
  - Options: New, Processing, Script Generated, Approved, Video Generated, Completed, Error
- **Channel** (Text) - YouTube channel name
- **YouTube Video ID** (Text) - Extracted video ID
- **Duration** (Text) - Video duration
- **View Count** (Number) - YouTube view count
- **Published Date** (Date) - YouTube publish date
- **Optimized Title** (Text) - AI-generated title
- **Optimized Description** (Text) - AI-generated description  
- **Keywords** (Multi-select) - SEO keywords
- **Script Approved** (Checkbox) - Manual approval flag
- **Total Sentences** (Number) - Count of script sentences
- **Completed Sentences** (Number) - Count of completed sentences
- **Progress** (Formula) - `prop("Completed Sentences") / prop("Total Sentences")`
- **Created Time** (Created time) - Auto-populated
- **Last Edited Time** (Last edited time) - Auto-populated

## Database 2: Video Details (Details Database)  
**Purpose**: Detailed sentence-by-sentence breakdown with tabular view

### Properties:
- **DetailID** (Formula) - `id()` - Unique identifier
- **Video** (Relation) - Links to Videos database
- **Sentence Number** (Number) - 1, 2, 3, etc.
- **Script Text** (Text) - The actual sentence content
- **Image Prompt** (Text) - AI-generated image description
- **Generated Image URL** (URL) - DALL-E generated image
- **Status** (Select) - Individual sentence status
  - Options: Pending, Processing, Image Generated, Complete
- **Word Count** (Formula) - `length(prop("Script Text"))` 
- **Created Time** (Created time) - Auto-populated
- **Last Edited Time** (Last edited time) - Auto-populated

## Benefits of New Structure:

### 🎯 Clean Main Database
- Fast loading and navigation
- Clear overview of all videos
- Easy status tracking and filtering
- Progress visualization

### 📊 Detailed Breakdown Database  
- Perfect tabular format for script sentences
- Individual sentence status tracking
- Easy to update image URLs
- Searchable and filterable content
- Unlimited sentences per video

### 🔄 Automated Relations
- Video Details automatically link to main Videos
- Progress automatically calculated
- Consistent data across databases

### 🚀 Scalability
- No character limits or truncation
- Easy to add new detail fields
- Better performance with large datasets
- Professional database structure

## Workflow Changes:

### Initial Processing:
1. Create main Video record (status: New)
2. Process YouTube data → update main record
3. Generate AI content → create Detail records
4. Update main record with totals and status

### Approval Workflow:
1. User reviews sentences in Details database
2. Approves via checkbox in main Videos database  
3. System processes approved sentences
4. Updates individual sentence statuses

### Progress Tracking:
- Real-time progress calculation in main database
- Individual sentence status in details database
- Clear visibility into processing stages