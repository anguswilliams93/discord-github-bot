// Test the feature request functionality for suggested-features channel
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Mock thread data for a feature request
const mockFeatureRequestData = {
    messages: [
        {
            author: "user1",
            content: "It would be great if we could add a dark mode to the application. The current bright interface is hard on the eyes during night use.",
            createdAt: new Date("2025-09-29T10:00:00Z"),
            attachments: 0
        },
        {
            author: "user2", 
            content: "I second this! Dark mode would be amazing. Maybe we could have a toggle in the settings?",
            createdAt: new Date("2025-09-29T10:05:00Z"),
            attachments: 0
        },
        {
            author: "user3",
            content: "Yes! And maybe we could also add different color themes like blue, green, etc. along with the dark mode.",
            createdAt: new Date("2025-09-29T10:10:00Z"),
            attachments: 0
        },
        {
            author: "developer1",
            content: "Great suggestions! We could implement this with CSS custom properties and a theme switcher component.",
            createdAt: new Date("2025-09-29T10:15:00Z"),
            attachments: 0
        }
    ],
    images: []
};

const channelName = "suggested-features";

async function testFeatureRequestAnalysis() {
    console.log('🌟 Testing feature request analysis functionality...\n');
    
    const claude = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Format all messages in the thread (same as bot does)
    let conversationText = '';
    mockFeatureRequestData.messages.forEach((msg, index) => {
        conversationText += `Message ${index + 1} (${msg.author} at ${msg.createdAt.toISOString()}):\n${msg.content}\n\n`;
    });
    
    // Determine if this should be a bug report or feature request
    const isFeatureRequest = channelName === 'suggested-features';
    const templateType = isFeatureRequest ? 'Feature request' : 'Bug report';
    const templateAbout = isFeatureRequest ? 'Suggest an idea for this project' : 'Create a report to help us improve';
    const labelType = isFeatureRequest ? 'enhancement' : 'bug';
    
    const prompt = `
Analyze this Discord thread from #${channelName} and create a structured GitHub issue following the standard ${templateType.toLowerCase()} template.

**Discord Thread:**
Channel: #${channelName}
Total Messages: ${mockFeatureRequestData.messages.length}
Images Attached: ${mockFeatureRequestData.images.length}

**Full Conversation:**
${conversationText}

Please analyze the entire conversation and create a comprehensive GitHub issue. Extract information from all messages in the thread to build a complete picture.

Generate a response in this EXACT format (use the GitHub ${templateType.toLowerCase()} template):

---
name: ${templateType}
about: ${templateAbout}
title: '[Brief descriptive title max 80 characters]'
labels: '${labelType}'
assignees: ''

---

${isFeatureRequest ? `**Is your feature request related to a problem? Please describe.**
[Clear and concise description of what the problem is based on the thread conversation]

**Describe the solution you'd like**
[Clear and concise description of what you want to happen based on the conversation]

**Describe alternatives you've considered**
[Any alternative solutions or features mentioned in the conversation]

**Additional context**
[Any other context or screenshots about the feature request from the thread]` : `**Describe the bug**
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
${mockFeatureRequestData.images.length > 0 ? `${mockFeatureRequestData.images.length} screenshot(s) provided in the Discord thread` : 'No screenshots provided'}

**Environment Information:**
- Platform: [Extract from conversation if mentioned, otherwise "Not specified"]
- Browser: [Extract from conversation if mentioned, otherwise "Not specified"] 
- Version: [Extract from conversation if mentioned, otherwise "Not specified"]
- Device: [Extract from conversation if mentioned, otherwise "Not specified"]

**Additional context**
[Any other relevant context from the thread conversation]`}

**Discord Thread Context**
- Original Channel: #${channelName}
- Thread Participants: ${[...new Set(mockFeatureRequestData.messages.map(m => m.author))].join(', ')}
- Messages in Thread: ${mockFeatureRequestData.messages.length}
- Date: ${mockFeatureRequestData.messages[0].createdAt.toDateString()}

IMPORTANT: Respond with ONLY the formatted ${templateType.toLowerCase()} above, no JSON or other formatting.`;

    try {
        console.log('🤖 Sending feature request thread to AI for analysis...');
        const response = await claude.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        }); 
        
        const featureRequestContent = response.content[0].text;
        
        console.log('✅ AI Analysis Complete!\n');
        console.log('🌟 Generated Feature Request:');
        console.log('=' .repeat(80));
        console.log(featureRequestContent);
        console.log('=' .repeat(80));
        
        // Extract title
        const titleMatch = featureRequestContent.match(/title: '(.+?)'/);
        const title = titleMatch ? titleMatch[1] : 'Failed to extract title';
        
        console.log(`\n🎯 Extracted Title: "${title}"`);
        console.log(`📊 Feature Request Analysis Stats:`);
        console.log(`   - Template Type: ${templateType}`);
        console.log(`   - Label: ${labelType}`);
        console.log(`   - Messages: ${mockFeatureRequestData.messages.length}`);
        console.log(`   - Participants: ${[...new Set(mockFeatureRequestData.messages.map(m => m.author))].join(', ')}`);
        console.log(`   - Channel: #${channelName}`);
        
        // Verify it's using the correct template
        if (featureRequestContent.includes('Is your feature request related to a problem?')) {
            console.log('✅ Correctly using Feature Request template');
        } else {
            console.log('❌ Error: Not using Feature Request template');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

console.log('🚀 Discord Bot Feature Request Test');
console.log('Testing suggested-features channel creates enhancement issues\n');

testFeatureRequestAnalysis();