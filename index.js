const cron = require('node-cron');

console.log('YouTube Automation Service Started');

// Example cron job - runs every minute
cron.schedule('* * * * *', () => {
    console.log('Cron job executed at:', new Date().toISOString());
});

console.log('Cron jobs scheduled successfully');