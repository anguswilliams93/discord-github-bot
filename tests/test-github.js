// Test GitHub API connection
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function testGitHub() {
    try {
        console.log('Testing GitHub API connection...');
        console.log('GitHub Owner:', process.env.GITHUB_OWNER);
        console.log('GitHub Repo:', process.env.GITHUB_REPO);
        console.log('GitHub Token (first 10 chars):', process.env.GITHUB_TOKEN?.substring(0, 10) + '...');
        
        const github = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        
        // Test authentication
        console.log('\n1. Testing authentication...');
        const { data: user } = await github.rest.users.getAuthenticated();
        console.log('✅ Authenticated as:', user.login);
        
        // Test repository access
        console.log('\n2. Testing repository access...');
        const { data: repo } = await github.rest.repos.get({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO
        });
        console.log('✅ Repository access confirmed:', repo.full_name);
        console.log('Repository permissions:', {
            has_issues: repo.has_issues,
            permissions: repo.permissions
        });
        
        // Test issue creation
        console.log('\n3. Testing issue creation...');
        const testIssue = await github.rest.issues.create({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            title: '[TEST] Discord Bot GitHub Integration Test',
            body: `This is a test issue created by the Discord bot.\n\nGenerated at: ${new Date().toISOString()}`,
            labels: ['test', 'bot-generated']
        });
        
        console.log('✅ Test issue created successfully!');
        console.log('Issue URL:', testIssue.data.html_url);
        console.log('Issue Number:', testIssue.data.number);
        
    } catch (error) {
        console.error('❌ GitHub API test failed:');
        console.error('Error message:', error.message);
        console.error('Status:', error.status);
        console.error('Response:', error.response?.data);
    }
}

testGitHub();