// Test the complete workflow locally
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Mock Discord message object
const mockMessage = {
    content: "The login button is not working on mobile devices. When users tap the login button, nothing happens and they can't access their accounts.",
    author: { username: "testuser" },
    createdAt: new Date(),
    url: "https://discord.com/channels/123/456/789",
    id: "test-message-id",
    attachments: new Map()
};

const mockChannelName = "ui-bugs";
const mockImages = [];

class TestWorkflow {
    constructor() {
        this.claude = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        this.github = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        
        this.CHANNEL_LABELS = {
            'ui-bugs': ['ui-bug', 'needs-triage'],
            'console-errors': ['console-error', 'bug'],
            'feature-tests': ['testing', 'needs-review'],
            'suggested-features': ['enhancement', 'feature-request']
        };
    }
    
    async processWithAI(message, channelName, images) {
        const prompt = `
Analyze this Discord message from #${channelName} and create a structured GitHub issue:

**Discord Message:**
Author: ${message.author.username}
Content: ${message.content}
Channel: #${channelName}
Timestamp: ${message.createdAt}
Images: ${images.length} attached

Please extract and format:
1. A clear, descriptive title (max 80 characters)
2. Issue type classification (bug, feature, enhancement, question)
3. Priority level (critical, high, medium, low)
4. Detailed description with steps to reproduce if it's a bug
5. Expected vs actual behavior if applicable

Respond in JSON format:
{
  "title": "concise descriptive title",
  "type": "bug|feature|enhancement|question",
  "priority": "critical|high|medium|low",
  "description": "detailed description",
  "stepsToReproduce": ["step 1", "step 2", "step 3"],
  "expectedBehavior": "what should happen",
  "actualBehavior": "what actually happens"
}`;

        try {
            console.log('🤖 Processing with AI...');
            const response = await this.claude.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            }); 
            
            const aiResponse = response.content[0].text;
            const parsed = JSON.parse(aiResponse);
            
            console.log('🤖 AI processing successful:', parsed);
            return parsed;
            
        } catch (error) {
            console.error('🤖 AI processing failed:', error.message);
            
            // Fallback to simple extraction
            return {
                title: `[${channelName}] ${message.content.substring(0, 60)}...`,
                type: 'bug',
                priority: 'medium',
                description: message.content,
                stepsToReproduce: [],
                expectedBehavior: '',
                actualBehavior: ''
            };
        }
    }
    
    formatIssueBody(message, channelName, aiSummary, images) {
        let body = `## Description\n${aiSummary.description}\n\n`;
        
        if (aiSummary.stepsToReproduce.length > 0) {
            body += `## Steps to Reproduce\n`;
            aiSummary.stepsToReproduce.forEach((step, index) => {
                body += `${index + 1}. ${step}\n`;
            });
            body += '\n';
        }
        
        if (aiSummary.expectedBehavior) {
            body += `## Expected Behavior\n${aiSummary.expectedBehavior}\n\n`;
        }
        
        if (aiSummary.actualBehavior) {
            body += `## Actual Behavior\n${aiSummary.actualBehavior}\n\n`;
        }
        
        // Discord context
        body += `## Discord Context\n`;
        body += `- **Original Message**: [${message.url}](${message.url})\n`;
        body += `- **Channel**: #${channelName}\n`;
        body += `- **Author**: @${message.author.username}\n`;
        body += `- **Timestamp**: ${message.createdAt.toISOString()}\n`;
        body += `- **Message ID**: ${message.id}\n\n`;
        
        // Images section
        if (images.length > 0) {
            body += `## Screenshots and Attachments\n`;
            images.forEach((image, index) => {
                body += `${index + 1}. [${image.name}](${image.url})\n`;
            });
            body += '\n';
        }
        
        // Metadata
        body += `---\n`;
        body += `**Auto-generated from Discord** | `;
        body += `**Type**: ${aiSummary.type} | `;
        body += `**Priority**: ${aiSummary.priority}`;
        
        return body;
    }
    
    async createGitHubIssue(message, channelName, aiSummary, images) {
        console.log('🐙 Starting GitHub issue creation...');
        console.log(`🐙 Channel: ${channelName}, Title: ${aiSummary.title}`);
        
        // Format issue body
        const issueBody = this.formatIssueBody(message, channelName, aiSummary, images);
        console.log('🐙 Issue body formatted');
        
        // Get repository owner for auto-assignment
        console.log('🐙 Getting repository info...');
        const repoInfo = await this.github.rest.repos.get({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO
        });
        const repoOwner = repoInfo.data.owner.login;
        console.log(`🐙 Repository owner: ${repoOwner}`);
        
        // Create issue
        console.log('🐙 Creating issue...');
        const issue = await this.github.rest.issues.create({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            title: aiSummary.title,
            body: issueBody,
            labels: this.CHANNEL_LABELS[channelName] || ['needs-triage'],
            assignees: [repoOwner]
        });
        
        console.log(`🐙 GitHub issue created: ${issue.data.html_url}`);
        return issue.data;
    }
    
    async runTest() {
        try {
            console.log('🚀 Starting complete workflow test...');
            
            // Process with AI
            const aiSummary = await this.processWithAI(mockMessage, mockChannelName, mockImages);
            
            // Create GitHub issue
            const githubIssue = await this.createGitHubIssue(mockMessage, mockChannelName, aiSummary, mockImages);
            
            console.log('✅ Test completed successfully!');
            console.log('Issue URL:', githubIssue.html_url);
            console.log('Issue Number:', githubIssue.number);
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

const test = new TestWorkflow();
test.runTest();