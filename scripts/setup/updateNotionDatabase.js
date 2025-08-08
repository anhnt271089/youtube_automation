import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to update Notion database schema to match README.md specification
 * 
 * Required Schema:
 * - YouTube URL (URL): Original video URL - ONLY FIELD REQUIRED FOR INPUT
 * - VideoID (Formula): Internal unique identifier - auto-generated using id() formula
 * - Title (Title): Video title (extracted from YouTube)
 * - Status (Select): Processing status with options: 'New', 'Processing', 'Script Generated', 'Approved', 'Video Generated', 'Completed', 'Error'
 * - Channel (Text): YouTube channel name (extracted from YouTube)
 * - YouTube Video ID (Text): YouTube video ID (extracted from URL)
 * - Duration (Text): Video duration (extracted from YouTube)
 * - View Count (Number): Video view count (extracted from YouTube)
 * - Published Date (Date): Video publish date (extracted from YouTube)
 * - Optimized Title (Text): AI-generated title
 * - Optimized Description (Text): AI-generated description
 * - Keywords (Multi-select): SEO keywords
 * - Script Approved (Checkbox): Manual approval flag
 * - Drive Folder (URL): Google Drive folder link
 * - Created Time (Created time): Auto-populated by Notion
 * - Last Edited Time (Last edited time): Auto-populated by Notion
 */

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || '24647ea75bd1802cadd5d20219a9ede4';

async function updateDatabaseSchema() {
    console.log('Starting Notion database schema update...');
    console.log(`Database ID: ${DATABASE_ID}`);

    try {
        // First, let's retrieve the current database to see what exists
        console.log('Retrieving current database structure...');
        const currentDatabase = await notion.databases.retrieve({
            database_id: DATABASE_ID
        });

        console.log('Current database title:', currentDatabase.title[0]?.plain_text || 'Untitled');
        console.log('Current properties:', Object.keys(currentDatabase.properties));

        // Define the complete schema according to README.md
        const requiredProperties = {
            // Manual Input Field
            "YouTube URL": {
                type: "url",
                url: {}
            },

            // Auto-populated Fields
            "VideoID": {
                type: "formula",
                formula: {
                    expression: "id()"
                }
            },

            "Title": {
                type: "title",
                title: {}
            },

            "Status": {
                type: "select",
                select: {
                    options: [
                        { name: "New", color: "blue" },
                        { name: "Processing", color: "yellow" },
                        { name: "Script Generated", color: "orange" },
                        { name: "Approved", color: "green" },
                        { name: "Video Generated", color: "purple" },
                        { name: "Completed", color: "gray" },
                        { name: "Error", color: "red" }
                    ]
                }
            },

            "Channel": {
                type: "rich_text",
                rich_text: {}
            },

            "YouTube Video ID": {
                type: "rich_text",
                rich_text: {}
            },

            "Duration": {
                type: "rich_text",
                rich_text: {}
            },

            "View Count": {
                type: "number",
                number: {
                    format: "number"
                }
            },

            "Published Date": {
                type: "date",
                date: {}
            },

            "Optimized Title": {
                type: "rich_text",
                rich_text: {}
            },

            "Optimized Description": {
                type: "rich_text",
                rich_text: {}
            },

            "Keywords": {
                type: "multi_select",
                multi_select: {
                    options: [
                        // Pre-populate with common SEO keywords
                        { name: "viral", color: "red" },
                        { name: "trending", color: "orange" },
                        { name: "entertainment", color: "yellow" },
                        { name: "educational", color: "green" },
                        { name: "music", color: "blue" },
                        { name: "comedy", color: "purple" },
                        { name: "technology", color: "pink" },
                        { name: "lifestyle", color: "brown" },
                        { name: "tutorial", color: "gray" }
                    ]
                }
            },

            "Script Approved": {
                type: "checkbox",
                checkbox: {}
            },

            "Drive Folder": {
                type: "url",
                url: {}
            },

            "Created Time": {
                type: "created_time",
                created_time: {}
            },

            "Last Edited Time": {
                type: "last_edited_time",
                last_edited_time: {}
            }
        };

        // Update the database with the complete schema
        console.log('Updating database schema...');
        const updatedDatabase = await notion.databases.update({
            database_id: DATABASE_ID,
            title: [
                {
                    type: "text",
                    text: {
                        content: "YouTube Automation Database"
                    }
                }
            ],
            description: [
                {
                    type: "text",
                    text: {
                        content: "Database for YouTube content automation workflow. Only 'YouTube URL' requires manual input - all other fields are auto-populated by the system."
                    }
                }
            ],
            properties: requiredProperties
        });

        console.log('✅ Database schema updated successfully!');
        console.log('Updated properties:', Object.keys(updatedDatabase.properties));

        return updatedDatabase;
    } catch (error) {
        console.error('❌ Error updating database schema:', error.message);
        if (error.code === 'unauthorized') {
            console.error('Please check your NOTION_TOKEN in the .env file');
        }
        throw error;
    }
}

async function addSampleEntries() {
    console.log('\nAdding sample entries...');

    const sampleVideos = [
        {
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Rick Astley - Never Gonna Give You Up (Official Video)'
        },
        {
            url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
            title: 'Me at the zoo'
        },
        {
            url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
            title: 'PSY - GANGNAM STYLE(강남스타일) M/V'
        }
    ];

    try {
        for (const video of sampleVideos) {
            console.log(`Adding sample entry: ${video.title}`);
            
            const response = await notion.pages.create({
                parent: { database_id: DATABASE_ID },
                properties: {
                    "YouTube URL": {
                        url: video.url
                    },
                    "Title": {
                        title: [
                            {
                                text: {
                                    content: video.title
                                }
                            }
                        ]
                    },
                    "Status": {
                        select: {
                            name: "New"
                        }
                    }
                }
            });

            console.log(`✅ Added: ${video.title} (ID: ${response.id})`);
        }

        console.log('✅ All sample entries added successfully!');
    } catch (error) {
        console.error('❌ Error adding sample entries:', error.message);
        throw error;
    }
}

async function main() {
    try {
        console.log('🚀 Starting Notion Database Setup');
        console.log('=====================================');

        // Update schema
        await updateDatabaseSchema();

        // Add sample entries
        await addSampleEntries();

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\nDatabase Overview:');
        console.log('- YouTube URL: Manual input field (ONLY field you need to fill)');
        console.log('- All other fields: Auto-populated by the automation system');
        console.log('- Status options: New, Processing, Script Generated, Approved, Video Generated, Completed, Error');
        console.log('- Sample entries added with popular YouTube videos');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { updateDatabaseSchema, addSampleEntries };