// Check recent issues
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

async function checkIssues() {
    const github = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });
    
    console.log('📋 Checking recent GitHub issues...\n');
    
    const { data: issues } = await github.rest.issues.listForRepo({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        state: 'all',
        per_page: 10,
        sort: 'created',
        direction: 'desc'
    });
    
    issues.forEach((issue, index) => {
        console.log(`${index + 1}. Issue #${issue.number}: ${issue.title}`);
        console.log(`   State: ${issue.state}`);
        console.log(`   Created: ${new Date(issue.created_at).toLocaleString()}`);
        console.log(`   URL: ${issue.html_url}`);
        console.log(`   Labels: ${issue.labels.map(l => l.name).join(', ')}`);
        console.log('');
    });
}

checkIssues().catch(console.error);