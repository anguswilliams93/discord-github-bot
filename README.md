# Discord GitHub Bot 🤖

A powerful Discord bot that automatically converts Discord conversations into well-structured GitHub issues using AI analysis. Perfect for development teams who want to streamline their bug reporting and feature request workflows.

## ✨ Features

### 🧵 **Thread-Wide Analysis**
- Analyzes entire Discord thread conversations, not just single messages
- Captures context from multiple participants and messages
- Extracts comprehensive information from discussions

### 📋 **Professional Issue Templates**
- **Bug Reports**: Uses standard GitHub bug report template for bugs
- **Feature Requests**: Uses GitHub feature request template for enhancements
- **Smart Channel Detection**: Automatically determines issue type based on Discord channel

### 🔍 **Advanced Scanning**
- **Channel Scanning**: Find unprocessed messages across monitored channels
- **Thread-Specific Scanning**: Scan individual threads when working inside them
- **Batch Processing**: Process multiple conversations at once
- **Closed Thread Filtering**: Skips archived/closed threads during scans

### 🤖 **AI-Powered Processing**
- Uses Claude AI to analyze conversations and extract structured information
- Generates professional issue descriptions with proper formatting
- Extracts reproduction steps, environment details, and expected behavior

### 🖼️ **Image & Attachment Support**
- Processes images and attachments from Discord messages
- Optimizes and resizes images automatically
- Includes image metadata and file information

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- Discord Bot Token
- GitHub Personal Access Token
- Anthropic API Key (for Claude AI)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anguswilliams93/discord-github-bot.git
   cd discord-github-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   # Discord
   DISCORD_TOKEN=your_discord_token
   DISCORD_CLIENT_ID=your_discord_client_id

   # AI APIs
   ANTHROPIC_API_KEY=your_anthropic_api_key

   # GitHub
   GITHUB_TOKEN=your_github_token
   GITHUB_OWNER=your_github_username
   GITHUB_REPO=your_repository_name

   # Environment
   NODE_ENV=production
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

### Discord Bot Setup

1. **Create a Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the bot token for your `.env` file

2. **Set Bot Permissions**
   - Enable the following permissions:
     - Read Messages
     - Send Messages
     - Read Message History
     - Add Reactions
     - Create Public Threads
     - Send Messages in Threads
     - Embed Links
     - Attach Files

3. **Invite Bot to Server**
   - Generate invite link with required permissions
   - Add bot to your Discord server

## 📖 Usage

### Monitored Channels

The bot monitors these channels by default:
- `#ui-bugs` → Creates bug reports with `ui-bug` label
- `#console-errors` → Creates bug reports with `console-error` label  
- `#feature-tests` → Creates issues with `testing` label
- `#suggested-features` → Creates feature requests with `enhancement` label

### Basic Workflow

1. **Users discuss issues** in monitored channels
2. **React with ✅** to any message in the conversation
3. **Bot analyzes the entire thread** and creates a comprehensive GitHub issue
4. **Professional issue** is created with proper formatting and labels

### Commands

#### `!help`
Shows all available commands and usage instructions.

#### `!scan [channel] [days]`
Scans for unprocessed messages across channels.

**Examples:**
```
!scan                    # Scan all channels, last 7 days
!scan ui-bugs           # Scan ui-bugs channel, last 7 days  
!scan console-errors 14 # Scan console-errors, last 14 days
```

#### `!scanthread [days]`
Scans the current thread only (must be used inside a thread).

**Examples:**
```
!scanthread             # Scan current thread, last 7 days
!scanthread 21          # Scan current thread, last 21 days
```

### Batch Processing

1. **Run a scan** with `!scan` or `!scanthread`
2. **Review unprocessed messages** in the results
3. **React with ✅** on the results to process all messages at once
4. **Watch progress** as issues are created automatically

## 📋 Issue Templates

### Bug Report Template
```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[Brief descriptive title]'
labels: 'bug'
assignees: ''
---

**Describe the bug**
[Clear description from thread analysis]

**To Reproduce**
Steps to reproduce the behavior:
1. [Extracted from conversation]
2. [Step by step guide]

**Expected behavior**
[What should happen]

**Screenshots**
[Attached images and files]

**Environment Information:**
- Platform: [iOS/Android/Web]
- Browser: [Chrome/Safari/etc]
- Version: [App version]
- Device: [Device model]

**Additional context**
[Other relevant information from thread]
```

### Feature Request Template
```markdown
---
name: Feature request
about: Suggest an idea for this project
title: '[Brief descriptive title]'
labels: 'enhancement'
assignees: ''
---

**Is your feature request related to a problem?**
[Problem description from conversation]

**Describe the solution you'd like**
[Proposed solution from discussion]

**Describe alternatives you've considered**
[Alternative approaches mentioned]

**Additional context**
[Screenshots, mockups, additional details]
```

## 🔧 Configuration

### Channel Configuration

Modify `MONITORED_CHANNELS` and `CHANNEL_LABELS` in `bot.js`:

```javascript
// Monitored channels
this.MONITORED_CHANNELS = [
    'ui-bugs', 
    'console-errors', 
    'feature-tests', 
    'suggested-features',
    'your-custom-channel'  // Add your channels
];

// Channel to label mapping
this.CHANNEL_LABELS = {
    'ui-bugs': ['ui-bug', 'needs-triage'],
    'console-errors': ['console-error', 'bug'],
    'feature-tests': ['testing', 'needs-review'],
    'suggested-features': ['enhancement', 'feature-request'],
    'your-custom-channel': ['custom-label']
};
```

### AI Model Configuration

Change the AI model in `processWithAI` method:
```javascript
const response = await this.claude.messages.create({
    model: 'claude-3-haiku-20240307', // Cost-effective
    // or
    model: 'claude-3-sonnet-20240229', // Higher quality
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
});
```

## 🏗️ Architecture

```
├── bot.js                 # Main bot application
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variables template
├── error.log             # Error logging (auto-generated)
└── README.md            # This documentation
```

### Key Components

- **DiscordGitHubBot**: Main bot class handling all functionality
- **Event Handlers**: Discord message and reaction event processing
- **AI Processing**: Claude integration for conversation analysis
- **GitHub Integration**: Issue creation and repository management
- **Image Processing**: Sharp-based image optimization
- **Logging**: Winston-based comprehensive logging

## 🛠️ Development

### Scripts

```bash
npm start          # Start the bot in production mode
npm run dev        # Start with nodemon for development
npm test           # Run tests (if available)
```

### Testing

The project includes test scripts:
- `test-github.js` - Test GitHub API connectivity
- `test-thread-analysis.js` - Test thread analysis functionality
- `test-feature-request.js` - Test feature request processing

Run tests:
```bash
node test-github.js
node test-thread-analysis.js
node test-feature-request.js
```

### Debugging

Enable debug logging by setting environment variable:
```env
NODE_ENV=development
```

Check logs:
```bash
tail -f error.log    # View error logs
```

## 🔐 Security & Best Practices

### Token Security
- Never commit actual tokens to version control
- Use environment variables for all sensitive data
- Rotate tokens regularly
- Use minimal required permissions

### GitHub Permissions
Required GitHub token permissions:
- `repo` (full repository access)
- `write:discussion` (if using discussions)

### Discord Permissions
Minimal required Discord permissions:
- View Channels
- Read Message History  
- Send Messages
- Add Reactions
- Create Public Threads
- Send Messages in Threads
- Embed Links
- Attach Files

## 📊 Performance & Limits

### Rate Limits
- **Discord API**: 50 requests per second
- **GitHub API**: 5000 requests per hour (authenticated)
- **Anthropic API**: Varies by plan

### Optimization Features
- Image compression and resizing
- Batch processing with delays
- Efficient message fetching with pagination
- Error handling and retry logic

## 🐛 Troubleshooting

### Common Issues

**Bot not responding:**
- Check if bot is online in Discord
- Verify bot has required permissions
- Check console for error messages

**GitHub issues not created:**
- Verify GitHub token has repository access
- Check repository name and owner in `.env`
- Review error logs for API failures

**AI processing fails:**
- Verify Anthropic API key is valid
- Check token usage limits
- Review conversation content for issues

**Thread scanning not working:**
- Ensure you're in a monitored channel's thread
- Check if thread is archived (skipped by default)
- Verify bot has thread permissions

### Debug Commands

```bash
# Test GitHub connectivity
node test-github.js

# Test AI processing
node test-thread-analysis.js

# Check bot status
!help
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API library
- [Anthropic Claude](https://www.anthropic.com/) - AI conversation analysis
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [Winston](https://github.com/winstonjs/winston) - Logging

## 📞 Support

- Create an issue in this repository for bugs or feature requests
- Check existing issues for known problems and solutions
- Join our Discord server for community support

---

**Made with ❤️ for development teams who want better issue tracking workflows**