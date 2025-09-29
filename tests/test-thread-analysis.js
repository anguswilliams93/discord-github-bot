// Test the new thread analysis functionality
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Mock thread data to test the new AI processing
const mockThreadData = {
    messages: [
        {
            author: "user1",
            content: "I'm having an issue with the login button on mobile. When I tap it, nothing happens.",
            createdAt: new Date("2025-09-29T10:00:00Z"),
            attachments: 1
        },
        {
            author: "user2", 
            content: "I can confirm this. I'm using iPhone 15 with Safari. The button highlights but doesn't redirect to the login page.",
            createdAt: new Date("2025-09-29T10:05:00Z"),
            attachments: 0
        },
        {
            author: "user1",
            content: "Steps I tried: 1. Open the app 2. Go to the main page 3. Tap the 'Login' button 4. Nothing happens - should open login form",
            createdAt: new Date("2025-09-29T10:10:00Z"),
            attachments: 0
        },
        {
            author: "developer1",
            content: "Thanks for the report! Can you check if you see any console errors? Also, what iOS version are you running?",
            createdAt: new Date("2025-09-29T10:15:00Z"),
            attachments: 0
        },
        {
            author: "user1",
            content: "iOS 17.5.1, no console errors visible. The issue started after the last app update.",
            createdAt: new Date("2025-09-29T10:20:00Z"),
            attachments: 0
        }
    ],
    images: [
        {
            url: "https://example.com/screenshot1.png",
            name: "login_issue_screenshot.png",
            type: "attachment"
        }
    ]
};

const channelName = "ui-bugs";

async function testThreadAnalysis() {
    console.log('🧵 Testing new thread analysis functionality...\n');
    
    const claude = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Format all messages in the thread (same as bot does)
    let conversationText = '';
    mockThreadData.messages.forEach((msg, index) => {
        conversationText += `Message ${index + 1} (${msg.author} at ${msg.createdAt.toISOString()}):\n${msg.content}\n\n`;
    });
    
    const prompt = `
Analyze this Discord thread from #${channelName} and create a structured GitHub issue following the standard bug report template.

**Discord Thread:**
Channel: #${channelName}
Total Messages: ${mockThreadData.messages.length}
Images Attached: ${mockThreadData.images.length}

**Full Conversation:**
${conversationText}

Please analyze the entire conversation and create a comprehensive GitHub issue. Extract information from all messages in the thread to build a complete picture.

Generate a response in this EXACT format (use the GitHub bug report template):

---
name: Bug report  
about: Create a report to help us improve
title: '[Brief descriptive title max 80 characters]'
labels: 'bug'
assignees: ''

---

**Describe the bug**
[Clear and concise description based on the thread conversation]

**To Reproduce**
Steps to reproduce the behavior:
1. [Step 1 from the thread]
2. [Step 2 from the thread]  
3. [Step 3 from the thread]
4. [Final step that shows the error]

**Expected behavior**
[Clear description of what should happen based on the conversation]

**Screenshots**
${mockThreadData.images.length > 0 ? `${mockThreadData.images.length} screenshot(s) provided in the Discord thread` : 'No screenshots provided'}

**Environment Information:**
- Platform: [Extract from conversation if mentioned, otherwise "Not specified"]
- Browser: [Extract from conversation if mentioned, otherwise "Not specified"] 
- Version: [Extract from conversation if mentioned, otherwise "Not specified"]
- Device: [Extract from conversation if mentioned, otherwise "Not specified"]

**Additional context**
[Any other relevant context from the thread conversation]

**Discord Thread Context**
- Original Channel: #${channelName}
- Thread Participants: ${[...new Set(mockThreadData.messages.map(m => m.author))].join(', ')}
- Messages in Thread: ${mockThreadData.messages.length}
- Date: ${mockThreadData.messages[0].createdAt.toDateString()}

IMPORTANT: Respond with ONLY the formatted bug report above, no JSON or other formatting.`;

    try {
        console.log('🤖 Sending thread to AI for analysis...');
        const response = await claude.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        }); 
        
        const bugReportContent = response.content[0].text;
        
        console.log('✅ AI Analysis Complete!\n');
        console.log('📋 Generated Bug Report:');
        console.log('=' .repeat(80));
        console.log(bugReportContent);
        console.log('=' .repeat(80));
        
        // Extract title
        const titleMatch = bugReportContent.match(/title: '(.+?)'/);
        const title = titleMatch ? titleMatch[1] : 'Failed to extract title';
        
        console.log(`\n🎯 Extracted Title: "${title}"`);
        console.log(`📊 Thread Analysis Stats:`);
        console.log(`   - Messages: ${mockThreadData.messages.length}`);
        console.log(`   - Participants: ${[...new Set(mockThreadData.messages.map(m => m.author))].join(', ')}`);
        console.log(`   - Images: ${mockThreadData.images.length}`);
        console.log(`   - Channel: #${channelName}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

console.log('🚀 Discord Bot Thread Analysis Test');
console.log('Testing the new functionality that analyzes entire Discord threads\n');

testThreadAnalysis();