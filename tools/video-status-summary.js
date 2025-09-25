#!/usr/bin/env node
import chalk from 'chalk';

function displayVideoStatusSummary() {
  console.log(chalk.bold.cyan('\n📊 YOUTUBE AUTOMATION - VIDEO STATUS SUMMARY\n'));
  console.log(chalk.gray('=' .repeat(80)));

  console.log(chalk.bold.blue('\n🎯 CURRENT SITUATION:\n'));
  console.log(chalk.white('• Google Sheets Authentication: ❌ EXPIRED/INVALID'));
  console.log(chalk.white('• Master Sheet ID: 1ZwFAUc2ijEUxulxgFxXQPx1isMSyH71-HKmhf4SoklI'));
  console.log(chalk.white('• System Status: ⚠️  AUTHENTICATION REQUIRED'));

  console.log(chalk.bold.yellow('\n📋 MANUAL GOOGLE SHEETS CHECK:\n'));
  console.log(chalk.cyan('1. Open the Google Sheets master sheet:'));
  console.log(chalk.gray('   https://docs.google.com/spreadsheets/d/1ZwFAUc2ijEUxulxgFxXQPx1isMSyH71-HKmhf4SoklI/edit'));

  console.log(chalk.cyan('\n2. Look for the "Videos" sheet tab'));

  console.log(chalk.cyan('\n3. Check these key columns:'));
  console.log(chalk.white('   Column A: 🤖 Video ID (VID-XXXX format)'));
  console.log(chalk.white('   Column B: 🔧 YouTube URL'));
  console.log(chalk.white('   Column C: 🤖 Status (Main processing status)'));
  console.log(chalk.white('   Column D: 🤖 Title'));
  console.log(chalk.white('   Column J: 👤 Script Approved (Pending/Approved/Needs Changes)'));
  console.log(chalk.white('   Column K: 👤 Voice Generation Status'));
  console.log(chalk.white('   Column L: 👤 Video Editing Status'));
  console.log(chalk.white('   Column N: 🤖 Detail Workbook URL'));

  console.log(chalk.bold.green('\n🔍 WHAT TO LOOK FOR:\n'));

  console.log(chalk.yellow('📌 NEW/UNPROCESSED VIDEOS (Need Processing):'));
  console.log(chalk.gray('   • Status (Column C): "New" or empty'));
  console.log(chalk.gray('   • These videos need initial processing'));
  console.log(chalk.gray('   • Action: Run the main processing workflow'));

  console.log(chalk.magenta('\n📌 READY FOR REVIEW (Need Manual Review):'));
  console.log(chalk.gray('   • Status (Column C): "Ready for Review"'));
  console.log(chalk.gray('   • Script Approved (Column J): "Pending"'));
  console.log(chalk.gray('   • Action: Review script in Detail Workbook and change J to "Approved"'));

  console.log(chalk.green('\n📌 APPROVED SCRIPTS (Ready for Voice Generation):'));
  console.log(chalk.gray('   • Status (Column C): "Approved"'));
  console.log(chalk.gray('   • Script Approved (Column J): "Approved"'));
  console.log(chalk.gray('   • Voice Generation Status (Column K): "Not Started" or empty'));
  console.log(chalk.gray('   • Action: Generate voice files'));

  console.log(chalk.red('\n📌 ERROR VIDEOS (Need Attention):'));
  console.log(chalk.gray('   • Status (Column C): Contains "Error" or "Failed"'));
  console.log(chalk.gray('   • Action: Check error logs and retry or fix manually'));

  console.log(chalk.blue('\n📌 IN PROGRESS (Currently Processing):'));
  console.log(chalk.gray('   • Status (Column C): "Processing", "Generating Script"'));
  console.log(chalk.gray('   • Action: Wait for completion or check for stuck processes'));

  console.log(chalk.bold.cyan('\n🔧 FIXING AUTHENTICATION:\n'));

  console.log(chalk.white('To restore programmatic access to Google Sheets:'));

  console.log(chalk.yellow('\n1. Google Cloud Console Setup:'));
  console.log(chalk.gray('   • Go to: https://console.cloud.google.com/'));
  console.log(chalk.gray('   • Select your project or create a new one'));
  console.log(chalk.gray('   • Enable Google Sheets API and Google Drive API'));

  console.log(chalk.yellow('\n2. OAuth Credentials:'));
  console.log(chalk.gray('   • Go to: APIs & Services > Credentials'));
  console.log(chalk.gray('   • Create OAuth 2.0 Client ID (Desktop application)'));
  console.log(chalk.gray('   • Download the client configuration'));

  console.log(chalk.yellow('\n3. Generate New Tokens:'));
  console.log(chalk.gray('   • Use Google OAuth Playground: https://developers.google.com/oauthplayground/'));
  console.log(chalk.gray('   • Select Google Sheets API v4 and Google Drive API v3'));
  console.log(chalk.gray('   • Authorize and exchange for tokens'));

  console.log(chalk.yellow('\n4. Update Environment:'));
  console.log(chalk.gray('   • Update .env file with new:'));
  console.log(chalk.gray('     - GOOGLE_CLIENT_ID'));
  console.log(chalk.gray('     - GOOGLE_CLIENT_SECRET'));
  console.log(chalk.gray('     - GOOGLE_ACCESS_TOKEN'));
  console.log(chalk.gray('     - GOOGLE_REFRESH_TOKEN'));

  console.log(chalk.bold.blue('\n⚡ RECOMMENDED WORKFLOW AFTER FIX:\n'));

  console.log(chalk.white('1. Check video statuses:'));
  console.log(chalk.cyan('   node tools/check-video-status-sheets.js'));

  console.log(chalk.white('\n2. Process new videos:'));
  console.log(chalk.cyan('   npm run process'));

  console.log(chalk.white('\n3. Review and approve scripts manually in Google Sheets'));

  console.log(chalk.white('\n4. Generate voice for approved scripts:'));
  console.log(chalk.cyan('   npm run generate-voice'));

  console.log(chalk.white('\n5. Monitor progress:'));
  console.log(chalk.cyan('   npm run status'));

  console.log(chalk.bold.red('\n🚨 IMPORTANT NOTES:\n'));
  console.log(chalk.white('• The system uses Google Sheets as the primary database'));
  console.log(chalk.white('• Each video has a Detail Workbook for scripts and analytics'));
  console.log(chalk.white('• Manual approval is required for script quality control'));
  console.log(chalk.white('• Voice generation only starts after script approval'));
  console.log(chalk.white('• All files are stored in Google Drive with shareable links'));

  console.log(chalk.gray('\n' + '=' .repeat(80)));
  console.log(chalk.yellow('Ryan, sir. Once authentication is fixed, the system can provide'));
  console.log(chalk.yellow('detailed video status analysis and processing recommendations.'));
  console.log(chalk.gray('=' .repeat(80) + '\n'));
}

// Run the summary
displayVideoStatusSummary();