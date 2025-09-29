// bot.js - Complete Discord bot with AI and GitHub integration
const { 
    Client, 
    Events, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder,
    AttachmentBuilder 
} = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const sharp = require('sharp');
const winston = require('winston');
require('dotenv').config();

class DiscordGitHubBot {
    constructor() {
        // Initialize Discord client
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions
            ],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction
            ]
        });
        
        // Initialize AI client (Claude)
        this.claude = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        // Initialize GitHub client
        this.github = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        
        // Monitored channels
        this.MONITORED_CHANNELS = [
            'ui-bugs', 
            'console-errors', 
            'feature-tests', 
            'suggested-features'
        ];
        
        // Channel to label mapping
        this.CHANNEL_LABELS = {
            'ui-bugs': ['ui-bug', 'needs-triage'],
            'console-errors': ['console-error', 'bug'],
            'feature-tests': ['testing', 'needs-review'],
            'suggested-features': ['enhancement', 'feature-request']
        };
        
        this.setupLogging();
        this.setupEventListeners();
    }
    
    setupLogging() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: 'error.log', 
                    level: 'error' 
                }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }
    
    setupEventListeners() {
        this.client.once(Events.ClientReady, this.onReady.bind(this));
        this.client.on(Events.MessageCreate, this.onMessage.bind(this));
        this.client.on(Events.MessageReactionAdd, this.onReactionAdd.bind(this));
        
        // Error handling
        this.client.on(Events.Error, error => {
            this.logger.error('Discord.js error:', error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled Rejection:', reason);
        });
    }
    
    onReady(readyClient) {
        this.logger.info(`✅ Bot ready! Logged in as ${readyClient.user.tag}`);
        this.logger.info(`📡 Monitoring channels: ${this.MONITORED_CHANNELS.join(', ')}`);
    }
    
    async onMessage(message) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Handle bot commands (must start with !)
        if (message.content.startsWith('!')) {
            await this.handleCommand(message);
            return;
        }
        
        // Check if message is in monitored channels
        if (this.MONITORED_CHANNELS.includes(message.channel.name)) {
            this.logger.info(`📝 Message in #${message.channel.name} by ${message.author.username}`);
            
            // Auto-react to encourage confirmation
            await message.react('✅');
            
            // Extract images for preview
            const images = await this.extractImages(message);
            if (images.length > 0) {
                this.logger.info(`🖼️ Found ${images.length} images in message`);
            }
        }
    }
    
    async handleCommand(message) {
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        this.logger.info(`🤖 Command received: !${command} from ${message.author.username}`);
        
        switch (command) {
            case 'scan':
                await this.handleScanCommand(message, args);
                break;
            case 'scanthread':
                await this.handleScanThreadCommand(message, args);
                break;
            case 'help':
                await this.handleHelpCommand(message);
                break;
            default:
                await message.reply('❓ Unknown command. Use `!help` for available commands.');
        }
    }
    
    async handleHelpCommand(message) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Discord GitHub Bot Commands')
            .setDescription('Available commands for managing GitHub issue creation')
            .setColor(0x5865F2)
            .addFields(
                { 
                    name: '!scan [channel] [days]', 
                    value: 'Scan for unprocessed messages\n• `!scan` - Scan all monitored channels (last 7 days)\n• `!scan ui-bugs` - Scan specific channel (last 7 days)\n• `!scan ui-bugs 14` - Scan specific channel (last 14 days)', 
                    inline: false 
                },
                { 
                    name: '!scanthread [days]', 
                    value: 'Scan current thread only\n• `!scanthread` - Scan current thread (last 7 days)\n• `!scanthread 14` - Scan current thread (last 14 days)\n**Note:** Only works when used inside a thread', 
                    inline: false 
                },
                { 
                    name: '!help', 
                    value: 'Show this help message', 
                    inline: false 
                },
                { 
                    name: 'Regular Usage', 
                    value: 'React with ✅ to any message in monitored channels to create a GitHub issue', 
                    inline: false 
                }
            )
            .addFields(
                { 
                    name: 'Monitored Channels', 
                    value: this.MONITORED_CHANNELS.map(c => `#${c}`).join(', '), 
                    inline: false 
                }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [helpEmbed] });
    }
    
    async handleScanThreadCommand(message, args) {
        const days = parseInt(args[0]) || 7;
        
        // Check if we're in a thread
        if (!message.channel.isThread()) {
            await message.reply('❌ This command only works inside a thread. Use `!scan` for regular channel scanning.');
            return;
        }
        
        // Check if thread is in a monitored channel
        const parentChannel = message.channel.parent;
        if (!parentChannel || !this.MONITORED_CHANNELS.includes(parentChannel.name)) {
            await message.reply(`❌ This thread is not in a monitored channel. Monitored channels: ${this.MONITORED_CHANNELS.map(c => `\`${c}\``).join(', ')}`);
            return;
        }
        
        // Validate days parameter
        if (days < 1 || days > 30) {
            await message.reply('❌ Days must be between 1 and 30.');
            return;
        }
        
        const scanEmbed = new EmbedBuilder()
            .setTitle('🧵 Scanning Current Thread')
            .setDescription(`Scanning this thread for unprocessed messages...`)
            .setColor(0xFFDD00)
            .addFields(
                { name: '🧵 Thread', value: message.channel.name, inline: true },
                { name: '📁 Parent Channel', value: `#${parentChannel.name}`, inline: true },
                { name: '📅 Time Range', value: `Last ${days} day(s)`, inline: true }
            )
            .setTimestamp();
        
        const statusMessage = await message.reply({ embeds: [scanEmbed] });
        
        try {
            const results = await this.scanThreadForUnprocessed(message.channel, days);
            await this.displayThreadScanResults(statusMessage, results, message.channel, days);
        } catch (error) {
            this.logger.error('Error during thread scan:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Thread Scan Failed')
                .setDescription(`Error occurred during thread scan: ${error.message}`)
                .setColor(0xFF6B6B)
                .setTimestamp();
            
            await statusMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    async scanThreadForUnprocessed(thread, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const results = {
            totalMessages: 0,
            unprocessedMessages: [],
            processedMessages: 0
        };
        
        this.logger.info(`🧵 Scanning thread: ${thread.name}...`);
        
        try {
            // Fetch messages from the thread
            let lastMessageId = null;
            let hasMoreMessages = true;
            
            while (hasMoreMessages) {
                const fetchOptions = { limit: 100 };
                if (lastMessageId) {
                    fetchOptions.before = lastMessageId;
                }
                
                const messages = await thread.messages.fetch(fetchOptions);
                
                if (messages.size === 0) {
                    hasMoreMessages = false;
                    break;
                }
                
                for (const [messageId, msg] of messages) {
                    // Stop if message is older than cutoff
                    if (msg.createdAt < cutoffDate) {
                        hasMoreMessages = false;
                        break;
                    }
                    
                    // Skip bot messages
                    if (msg.author.bot) continue;
                    
                    // Skip empty messages or very short messages
                    if (!msg.content || msg.content.trim().length < 10) continue;
                    
                    results.totalMessages++;
                    
                    // Check if message has been processed (has ✅ reaction from bot)
                    const checkmarkReactions = msg.reactions.cache.filter(reaction => 
                        reaction.emoji.name === '✅'
                    );
                    
                    let processedByBot = false;
                    for (const [reactionId, reaction] of checkmarkReactions) {
                        const users = await reaction.users.fetch();
                        if (users.has(this.client.user.id)) {
                            processedByBot = true;
                            break;
                        }
                    }
                    
                    if (processedByBot) {
                        results.processedMessages++;
                    } else {
                        results.unprocessedMessages.push({
                            id: msg.id,
                            channel: thread.parent.name,
                            threadName: thread.name,
                            content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                            author: msg.author.username,
                            createdAt: msg.createdAt,
                            url: msg.url,
                            attachments: msg.attachments.size
                        });
                    }
                    
                    lastMessageId = messageId;
                }
            }
        } catch (error) {
            this.logger.error(`Error scanning thread ${thread.name}:`, error);
        }
        
        this.logger.info(`🧵 Thread scan complete: ${results.totalMessages} total, ${results.unprocessedMessages.length} unprocessed`);
        return results;
    }
    
    async displayThreadScanResults(statusMessage, results, thread, days) {
        const { totalMessages, unprocessedMessages, processedMessages } = results;
        
        // Create summary embed
        const summaryEmbed = new EmbedBuilder()
            .setTitle('🧵 Thread Scan Results')
            .setDescription(`Scanned thread "${thread.name}" for the last ${days} day(s)`)
            .setColor(unprocessedMessages.length > 0 ? 0xFFDD00 : 0x57F287)
            .addFields(
                { name: '📝 Total Messages', value: totalMessages.toString(), inline: true },
                { name: '✅ Already Processed', value: processedMessages.toString(), inline: true },
                { name: '⏳ Unprocessed', value: unprocessedMessages.length.toString(), inline: true },
                { name: '🧵 Thread', value: thread.name, inline: true },
                { name: '📁 Parent Channel', value: `#${thread.parent.name}`, inline: true },
                { name: '🔒 Thread Status', value: thread.archived ? 'Archived' : 'Active', inline: true }
            )
            .setTimestamp();
        
        await statusMessage.edit({ embeds: [summaryEmbed] });
        
        // If there are unprocessed messages, show them
        if (unprocessedMessages.length > 0) {
            await this.displayUnprocessedMessages(statusMessage, unprocessedMessages.slice(0, 10)); // Show first 10
            
            if (unprocessedMessages.length > 10) {
                const moreEmbed = new EmbedBuilder()
                    .setDescription(`📝 Showing first 10 of ${unprocessedMessages.length} unprocessed messages in this thread.`)
                    .setColor(0x99AAB5);
                
                await statusMessage.channel.send({ embeds: [moreEmbed] });
            }
        }
    }
    
    async handleScanCommand(message, args) {
        const channelName = args[0];
        const days = parseInt(args[1]) || 7;
        
        // Validate days parameter
        if (days < 1 || days > 30) {
            await message.reply('❌ Days must be between 1 and 30.');
            return;
        }
        
        let channelsToScan = [];
        
        if (channelName) {
            // Scan specific channel
            if (!this.MONITORED_CHANNELS.includes(channelName)) {
                await message.reply(`❌ Channel \`${channelName}\` is not monitored. Monitored channels: ${this.MONITORED_CHANNELS.map(c => `\`${c}\``).join(', ')}`);
                return;
            }
            channelsToScan = [channelName];
        } else {
            // Scan all monitored channels
            channelsToScan = this.MONITORED_CHANNELS;
        }
        
        const scanEmbed = new EmbedBuilder()
            .setTitle('🔍 Starting Channel Scan')
            .setDescription(`Scanning for unprocessed messages...`)
            .setColor(0xFFDD00)
            .addFields(
                { name: '📁 Channels', value: channelsToScan.map(c => `#${c}`).join(', '), inline: true },
                { name: '📅 Time Range', value: `Last ${days} day(s)`, inline: true },
                { name: '⏳ Status', value: 'In Progress...', inline: true }
            )
            .setTimestamp();
        
        const statusMessage = await message.reply({ embeds: [scanEmbed] });
        
        try {
            const results = await this.scanChannelsForUnprocessed(channelsToScan, days);
            await this.displayScanResults(statusMessage, results, channelsToScan, days);
        } catch (error) {
            this.logger.error('Error during channel scan:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Scan Failed')
                .setDescription(`Error occurred during scan: ${error.message}`)
                .setColor(0xFF6B6B)
                .setTimestamp();
            
            await statusMessage.edit({ embeds: [errorEmbed] });
        }
    }
    
    async scanChannelsForUnprocessed(channelNames, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const results = {
            totalMessages: 0,
            unprocessedMessages: [],
            processedMessages: 0,
            channelStats: {}
        };
        
        for (const channelName of channelNames) {
            this.logger.info(`🔍 Scanning #${channelName}...`);
            
            const channel = this.client.channels.cache.find(ch => ch.name === channelName);
            if (!channel) {
                this.logger.warn(`Channel #${channelName} not found`);
                continue;
            }
            
            const channelStats = {
                total: 0,
                unprocessed: 0,
                processed: 0
            };
            
            try {
                // Fetch messages from the channel
                let lastMessageId = null;
                let hasMoreMessages = true;
                
                while (hasMoreMessages) {
                    const fetchOptions = { limit: 100 };
                    if (lastMessageId) {
                        fetchOptions.before = lastMessageId;
                    }
                    
                    const messages = await channel.messages.fetch(fetchOptions);
                    
                    if (messages.size === 0) {
                        hasMoreMessages = false;
                        break;
                    }
                    
                    for (const [messageId, msg] of messages) {
                        // Stop if message is older than cutoff
                        if (msg.createdAt < cutoffDate) {
                            hasMoreMessages = false;
                            break;
                        }
                        
                        // Skip bot messages
                        if (msg.author.bot) continue;
                        
                        // Skip empty messages or very short messages
                        if (!msg.content || msg.content.trim().length < 10) continue;
                        
                        // Skip messages that are in archived/closed threads
                        if (msg.hasThread && msg.thread && msg.thread.archived) {
                            this.logger.info(`Skipping message in archived thread: ${msg.thread.name}`);
                            continue;
                        }
                        
                        channelStats.total++;
                        results.totalMessages++;
                        
                        // Check if message has been processed (has ✅ reaction from bot)
                        const checkmarkReactions = msg.reactions.cache.filter(reaction => 
                            reaction.emoji.name === '✅'
                        );
                        
                        let processedByBot = false;
                        for (const [reactionId, reaction] of checkmarkReactions) {
                            const users = await reaction.users.fetch();
                            if (users.has(this.client.user.id)) {
                                processedByBot = true;
                                break;
                            }
                        }
                        
                        if (processedByBot) {
                            channelStats.processed++;
                            results.processedMessages++;
                        } else {
                            channelStats.unprocessed++;
                            results.unprocessedMessages.push({
                                id: msg.id,
                                channel: channelName,
                                content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                                author: msg.author.username,
                                createdAt: msg.createdAt,
                                url: msg.url,
                                attachments: msg.attachments.size
                            });
                        }
                        
                        lastMessageId = messageId;
                    }
                }
            } catch (error) {
                this.logger.error(`Error scanning #${channelName}:`, error);
            }
            
            results.channelStats[channelName] = channelStats;
            this.logger.info(`📊 #${channelName}: ${channelStats.total} total, ${channelStats.unprocessed} unprocessed`);
        }
        
        return results;
    }
    
    async displayScanResults(statusMessage, results, channelsScanned, days) {
        const { totalMessages, unprocessedMessages, processedMessages, channelStats } = results;
        
        // Create summary embed
        const summaryEmbed = new EmbedBuilder()
            .setTitle('📊 Scan Results Summary')
            .setDescription(`Scanned ${channelsScanned.length} channel(s) for the last ${days} day(s)`)
            .setColor(unprocessedMessages.length > 0 ? 0xFFDD00 : 0x57F287)
            .addFields(
                { name: '📝 Total Messages', value: totalMessages.toString(), inline: true },
                { name: '✅ Already Processed', value: processedMessages.toString(), inline: true },
                { name: '⏳ Unprocessed', value: unprocessedMessages.length.toString(), inline: true }
            )
            .setTimestamp();
        
        // Add channel breakdown
        let channelBreakdown = '';
        for (const [channel, stats] of Object.entries(channelStats)) {
            channelBreakdown += `**#${channel}**: ${stats.unprocessed}/${stats.total} unprocessed\n`;
        }
        if (channelBreakdown) {
            summaryEmbed.addFields({ name: '📁 Channel Breakdown', value: channelBreakdown });
        }
        
        await statusMessage.edit({ embeds: [summaryEmbed] });
        
        // If there are unprocessed messages, show them with reaction options
        if (unprocessedMessages.length > 0) {
            await this.displayUnprocessedMessages(statusMessage, unprocessedMessages.slice(0, 10)); // Show first 10
            
            if (unprocessedMessages.length > 10) {
                const moreEmbed = new EmbedBuilder()
                    .setDescription(`📝 Showing first 10 of ${unprocessedMessages.length} unprocessed messages. React with 🔄 to see more.`)
                    .setColor(0x99AAB5);
                
                await statusMessage.channel.send({ embeds: [moreEmbed] });
            }
        }
    }
    
    async displayUnprocessedMessages(statusMessage, messages) {
        const embed = new EmbedBuilder()
            .setTitle('⏳ Unprocessed Messages')
            .setDescription('React with ✅ to process these messages into GitHub issues:')
            .setColor(0xFFDD00);
        
        messages.forEach((msg, index) => {
            embed.addFields({
                name: `${index + 1}. #${msg.channel} - @${msg.author}`,
                value: `${msg.content}\n[Jump to message](${msg.url}) • ${msg.createdAt.toLocaleDateString()} • ${msg.attachments > 0 ? `📎 ${msg.attachments} attachment(s)` : 'No attachments'}`,
                inline: false
            });
        });
        
        const messageReply = await statusMessage.channel.send({ embeds: [embed] });
        
        // Add reactions for batch processing
        await messageReply.react('✅'); // Process all
        await messageReply.react('❌'); // Cancel
        
        return messageReply;
    }
    
    async onReactionAdd(reaction, user) {
        // Handle partial reactions (for older messages)
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                this.logger.error('Error fetching reaction:', error);
                return;
            }
        }
        
        // Ignore bot reactions
        if (user.bot) return;
        
        // Handle batch processing reactions (from scan results)
        if (reaction.message.author.id === this.client.user.id && 
            reaction.message.embeds.length > 0 && 
            reaction.message.embeds[0].title === '⏳ Unprocessed Messages') {
            
            if (reaction.emoji.name === '✅') {
                await this.handleBatchProcessing(reaction, user);
                return;
            } else if (reaction.emoji.name === '❌') {
                await this.handleBatchCancel(reaction, user);
                return;
            }
        }
        
        // Check for checkmark emoji and monitored channels
        if (reaction.emoji.name === '✅' && 
            this.MONITORED_CHANNELS.includes(reaction.message.channel.name)) {
            
            this.logger.info(`✅ Checkmark confirmed by ${user.username} in #${reaction.message.channel.name}`);
            await this.handleConfirmation(reaction, user);
        }
    }
    
    async handleBatchProcessing(reaction, user) {
        this.logger.info(`🔄 Batch processing initiated by ${user.username}`);
        
        const embed = reaction.message.embeds[0];
        const messageUrls = [];
        
        // Extract message URLs from embed fields
        embed.fields.forEach(field => {
            const urlMatch = field.value.match(/\[Jump to message\]\((https:\/\/[^\)]+)\)/);
            if (urlMatch) {
                messageUrls.push(urlMatch[1]);
            }
        });
        
        if (messageUrls.length === 0) {
            await reaction.message.reply('❌ No messages found to process.');
            return;
        }
        
        const statusEmbed = new EmbedBuilder()
            .setTitle('🔄 Batch Processing Started')
            .setDescription(`Processing ${messageUrls.length} messages...`)
            .setColor(0xFFDD00)
            .addFields(
                { name: '⏳ Status', value: 'Starting batch processing...', inline: false },
                { name: '📊 Progress', value: '0 / ' + messageUrls.length, inline: true },
                { name: '✅ Completed', value: '0', inline: true },
                { name: '❌ Failed', value: '0', inline: true }
            )
            .setTimestamp();
        
        const statusMessage = await reaction.message.reply({ embeds: [statusEmbed] });
        
        let completed = 0;
        let failed = 0;
        
        for (let i = 0; i < messageUrls.length; i++) {
            const messageUrl = messageUrls[i];
            
            try {
                // Parse Discord message URL to get guild, channel, and message ID
                const urlParts = messageUrl.split('/');
                const messageId = urlParts[urlParts.length - 1];
                const channelId = urlParts[urlParts.length - 2];
                
                // Find the channel and message
                const channel = this.client.channels.cache.get(channelId);
                if (!channel) {
                    throw new Error('Channel not found');
                }
                
                const message = await channel.messages.fetch(messageId);
                if (!message) {
                    throw new Error('Message not found');
                }
                
                // Create a mock reaction object for handleConfirmation
                const mockReaction = {
                    message: message,
                    emoji: { name: '✅' }
                };
                
                await this.handleConfirmation(mockReaction, user);
                completed++;
                
                this.logger.info(`✅ Processed message ${i + 1}/${messageUrls.length}`);
                
            } catch (error) {
                failed++;
                this.logger.error(`❌ Failed to process message ${i + 1}:`, error);
            }
            
            // Update progress every 3 messages or at the end
            if ((i + 1) % 3 === 0 || i === messageUrls.length - 1) {
                const updatedEmbed = new EmbedBuilder()
                    .setTitle('🔄 Batch Processing in Progress')
                    .setDescription(`Processing ${messageUrls.length} messages...`)
                    .setColor(0xFFDD00)
                    .addFields(
                        { name: '⏳ Status', value: `Processing message ${i + 1} of ${messageUrls.length}...`, inline: false },
                        { name: '📊 Progress', value: `${i + 1} / ${messageUrls.length}`, inline: true },
                        { name: '✅ Completed', value: completed.toString(), inline: true },
                        { name: '❌ Failed', value: failed.toString(), inline: true }
                    )
                    .setTimestamp();
                
                await statusMessage.edit({ embeds: [updatedEmbed] });
            }
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Final status update
        const finalEmbed = new EmbedBuilder()
            .setTitle('🎉 Batch Processing Complete')
            .setDescription(`Processed ${messageUrls.length} messages`)
            .setColor(failed > 0 ? 0xFFDD00 : 0x57F287)
            .addFields(
                { name: '📊 Total', value: messageUrls.length.toString(), inline: true },
                { name: '✅ Completed', value: completed.toString(), inline: true },
                { name: '❌ Failed', value: failed.toString(), inline: true }
            )
            .setTimestamp();
        
        await statusMessage.edit({ embeds: [finalEmbed] });
    }
    
    async handleBatchCancel(reaction, user) {
        this.logger.info(`❌ Batch processing cancelled by ${user.username}`);
        
        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Batch Processing Cancelled')
            .setDescription('Batch processing was cancelled by user request.')
            .setColor(0xFF6B6B)
            .addFields(
                { name: '👤 Cancelled by', value: user.username, inline: true }
            )
            .setTimestamp();
        
        await reaction.message.reply({ embeds: [cancelEmbed] });
    }
    
    async handleConfirmation(reaction, user) {
        const message = reaction.message;
        const channelName = message.channel.name;
        
        this.logger.info(`🔄 Starting handleConfirmation for message in #${channelName}`);
        
        try {
            // Create or get existing thread
            let thread;
            if (message.hasThread) {
                thread = message.thread;
                this.logger.info('📝 Using existing thread');
            } else {
                thread = await message.startThread({
                    name: `✅ Processing: ${message.content.substring(0, 40)}...`,
                    autoArchiveDuration: 1440 // 24 hours
                });
                this.logger.info('📝 Created new thread');
            }
            
            // Send initial confirmation
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🔄 Processing Confirmation')
                .setDescription('Creating GitHub issue from Discord message...')
                .setColor(0xFFDD00)
                .addFields(
                    { name: '👤 Confirmed by', value: user.username, inline: true },
                    { name: '📁 Channel', value: `#${channelName}`, inline: true },
                    { name: '🔗 Original', value: `[Jump to message](${message.url})` }
                )
                .setTimestamp();
            
            const processingMessage = await thread.send({ embeds: [confirmEmbed] });
            
            // Collect thread messages and images
            this.logger.info('� Analyzing entire thread...');
            const threadData = await this.collectThreadMessages(message);
            this.logger.info(`� Found ${threadData.messages.length} messages and ${threadData.images.length} images in thread`);
            
            // Process with AI
            this.logger.info('🤖 Processing thread with AI...');
            const aiSummary = await this.processWithAI(message, channelName, threadData);
            this.logger.info('🤖 AI processing completed');
            
            // Create GitHub issue
            this.logger.info('🐙 Creating GitHub issue...');
            const githubIssue = await this.createGitHubIssue(message, channelName, aiSummary, threadData.images);
            this.logger.info('🐙 GitHub issue created successfully');
            
            // Update with success
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ GitHub Issue Created Successfully')
                .setDescription(aiSummary.title)
                .setColor(0x57F287)
                .addFields(
                    { name: '🎫 Issue Number', value: `#${githubIssue.number}`, inline: true },
                    { name: '🏷️ Labels', value: githubIssue.labels.map(l => l.name).join(', '), inline: true },
                    { name: '🧵 Thread Messages', value: threadData.messages.length.toString(), inline: true },
                    { name: '🖼️ Images', value: threadData.images.length.toString(), inline: true },
                    { name: '� Participants', value: [...new Set(threadData.messages.map(m => m.author))].join(', '), inline: false },
                    { name: '�🔗 GitHub Link', value: `[View Issue](${githubIssue.html_url})` },
                    { name: '📋 Discord Link', value: `[Original Message](${message.url})` }
                )
                .setTimestamp();
            
            await processingMessage.edit({ embeds: [successEmbed] });
            
            // Process and display images in thread
            if (threadData.images.length > 0) {
                await this.processImagesInThread(thread, threadData.images);
            }
            
        } catch (error) {
            this.logger.error('Error handling confirmation:', error);
            this.logger.error('Error stack:', error.stack);
            
            // Send error message to thread if thread was created
            try {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Error Processing Request')
                    .setDescription(`Failed to create GitHub issue: ${error.message}`)
                    .setColor(0xFF6B6B)
                    .setTimestamp();
                
                if (thread) {
                    await thread.send({ embeds: [errorEmbed] });
                }
            } catch (threadError) {
                this.logger.error('Error sending error message to thread:', threadError);
            }
        }
    }
    
    async extractImages(message) {
        const images = [];
        
        // Extract from attachments
        message.attachments.forEach(attachment => {
            if (attachment.contentType?.startsWith('image/')) {
                images.push({
                    url: attachment.url,
                    name: attachment.name,
                    size: attachment.size,
                    type: 'attachment'
                });
            }
        });
        
        // Extract from embedded images (URL patterns)
        const imageUrlRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/gi;
        const imageUrls = message.content.match(imageUrlRegex) || [];
        
        imageUrls.forEach(url => {
            images.push({
                url: url,
                name: url.split('/').pop(),
                type: 'embedded'
            });
        });
        
        return images;
    }
    
    async collectThreadMessages(message) {
        const threadMessages = [];
        let allImages = [];
        
        // Check if this message has a thread
        if (message.hasThread) {
            try {
                const thread = message.thread;
                const messages = await thread.messages.fetch({ limit: 100 });
                
                // Sort messages by creation time
                const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);
                
                for (const [messageId, msg] of sortedMessages) {
                    if (!msg.author.bot) { // Skip bot messages
                        threadMessages.push({
                            author: msg.author.username,
                            content: msg.content,
                            createdAt: msg.createdAt,
                            attachments: msg.attachments.size
                        });
                        
                        // Extract images from thread messages
                        const msgImages = await this.extractImages(msg);
                        allImages = allImages.concat(msgImages);
                    }
                }
            } catch (error) {
                this.logger.error('Error fetching thread messages:', error);
            }
        }
        
        // Add the original message
        threadMessages.unshift({
            author: message.author.username,
            content: message.content,
            createdAt: message.createdAt,
            attachments: message.attachments.size
        });
        
        // Extract images from original message
        const originalImages = await this.extractImages(message);
        allImages = allImages.concat(originalImages);
        
        return {
            messages: threadMessages,
            images: allImages
        };
    }
    
    async processWithAI(message, channelName, threadData) {
        const { messages, images } = threadData;
        
        // Format all messages in the thread
        let conversationText = '';
        messages.forEach((msg, index) => {
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
Total Messages: ${messages.length}
Images Attached: ${images.length}

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
${images.length > 0 ? `${images.length} screenshot(s) provided in the Discord thread` : 'No screenshots provided'}

**Environment Information:**
- Platform: [Extract from conversation if mentioned, otherwise "Not specified"]
- Browser: [Extract from conversation if mentioned, otherwise "Not specified"] 
- Version: [Extract from conversation if mentioned, otherwise "Not specified"]
- Device: [Extract from conversation if mentioned, otherwise "Not specified"]

**Additional context**
[Any other relevant context from the thread conversation]`}

**Discord Thread Context**
- Original Channel: #${channelName}
- Thread Participants: ${[...new Set(messages.map(m => m.author))].join(', ')}
- Messages in Thread: ${messages.length}
- Date: ${messages[0].createdAt.toDateString()}

IMPORTANT: Respond with ONLY the formatted ${templateType.toLowerCase()} above, no JSON or other formatting.`;

        try {
            const response = await this.claude.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }]
            }); 
            
            const bugReportContent = response.content[0].text;
            
            // Extract title from the response
            const titleMatch = bugReportContent.match(/title: '(.+?)'/);
            const title = titleMatch ? titleMatch[1] : `[${channelName}] ${messages[0].content.substring(0, 60)}...`;
            
            this.logger.info('AI processing successful - bug report generated');
            return {
                title: title,
                type: this.inferTypeFromChannel(channelName),
                priority: 'medium',
                bugReportContent: bugReportContent,
                rawContent: bugReportContent // Keep the full formatted content
            };
            
        } catch (error) {
            this.logger.error('AI processing failed:', error);
            
            // Fallback to simple bug report or feature request
            const fallbackReport = this.generateFallbackBugReport(messages, channelName, images);
            return {
                title: `[${channelName}] ${messages[0].content.substring(0, 60)}...`,
                type: this.inferTypeFromChannel(channelName),
                priority: 'medium',
                bugReportContent: fallbackReport,
                rawContent: fallbackReport
            };
        }
    }
    
    generateFallbackBugReport(messages, channelName, images) {
        const title = `[${channelName}] ${messages[0].content.substring(0, 60)}...`;
        const isFeatureRequest = channelName === 'suggested-features';
        
        if (isFeatureRequest) {
            return `---
name: Feature request
about: Suggest an idea for this project
title: '${title}'
labels: 'enhancement'
assignees: ''

---

**Is your feature request related to a problem? Please describe.**
${messages[0].content}

**Describe the solution you'd like**
Solution details not specified in the original request.

**Describe alternatives you've considered**
No alternatives mentioned in the original request.

**Additional context**
${messages.length > 1 ? `Thread contains ${messages.length} messages with additional context.` : 'Single message request.'}
${images.length > 0 ? `${images.length} screenshot(s) provided in the Discord thread.` : ''}

**Discord Thread Context**
- Original Channel: #${channelName}
- Thread Participants: ${[...new Set(messages.map(m => m.author))].join(', ')}
- Messages in Thread: ${messages.length}
- Date: ${messages[0].createdAt.toDateString()}`;
        } else {
            return `---
name: Bug report
about: Create a report to help us improve  
title: '${title}'
labels: 'bug'
assignees: ''

---

**Describe the bug**
${messages[0].content}

**To Reproduce**
Steps to reproduce the behavior:
1. See original Discord message for details
2. Issue reported in #${channelName}

**Expected behavior**
Expected behavior not specified in the original report.

**Screenshots**
${images.length > 0 ? `${images.length} screenshot(s) provided in the Discord thread` : 'No screenshots provided'}

**Environment Information:**
- Platform: Not specified
- Browser: Not specified
- Version: Not specified  
- Device: Not specified

**Additional context**
${messages.length > 1 ? `Thread contains ${messages.length} messages with additional context.` : 'Single message report.'}

**Discord Thread Context**
- Original Channel: #${channelName}
- Thread Participants: ${[...new Set(messages.map(m => m.author))].join(', ')}
- Messages in Thread: ${messages.length}
- Date: ${messages[0].createdAt.toDateString()}`;
        }
    }
    
    inferTypeFromChannel(channelName) {
        const typeMap = {
            'ui-bugs': 'bug',
            'console-errors': 'bug',
            'feature-tests': 'testing',
            'suggested-features': 'enhancement'
        };
        return typeMap[channelName] || 'question';
    }
    
    async createGitHubIssue(message, channelName, aiSummary, images) {
        this.logger.info('🐙 Starting GitHub issue creation...');
        this.logger.info(`🐙 Channel: ${channelName}, Title: ${aiSummary.title}`);
        
        // Format issue body
        const issueBody = this.formatIssueBody(message, channelName, aiSummary, images);
        this.logger.info('🐙 Issue body formatted');
        
        // Get repository owner for auto-assignment
        this.logger.info('🐙 Getting repository info...');
        const repoInfo = await this.github.rest.repos.get({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO
        });
        const repoOwner = repoInfo.data.owner.login;
        this.logger.info(`🐙 Repository owner: ${repoOwner}`);
        
        // Create issue
        this.logger.info('🐙 Creating issue...');
        const issue = await this.github.rest.issues.create({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            title: aiSummary.title,
            body: issueBody,
            labels: this.CHANNEL_LABELS[channelName] || ['needs-triage'],
            assignees: [repoOwner]
        });
        
        this.logger.info(`🐙 GitHub issue created: ${issue.data.html_url}`);
        return issue.data;
    }
    
    formatIssueBody(message, channelName, aiSummary, images) {
        // Use the AI-generated bug report content directly
        let body = aiSummary.bugReportContent || aiSummary.rawContent;
        
        // Add Discord-specific footer information
        body += `\n\n---\n\n`;
        body += `**🤖 Auto-generated from Discord Thread**\n\n`;
        body += `**Discord Context:**\n`;
        body += `- **Original Message**: [${message.url}](${message.url})\n`;
        body += `- **Channel**: #${channelName}\n`;
        body += `- **Author**: @${message.author.username}\n`;
        body += `- **Timestamp**: ${message.createdAt.toISOString()}\n`;
        body += `- **Message ID**: ${message.id}\n`;
        
        // Add image links if any
        if (images.length > 0) {
            body += `\n**Attached Screenshots/Files:**\n`;
            images.forEach((image, index) => {
                body += `${index + 1}. [${image.name}](${image.url}) (${image.type})\n`;
            });
        }
        
        return body;
    }
    
    async processImagesInThread(thread, images) {
        for (const image of images.slice(0, 3)) { // Limit to 3 images
            try {
                const response = await axios.get(image.url, { 
                    responseType: 'arraybuffer',
                    timeout: 10000
                });
                
                const buffer = Buffer.from(response.data);
                
                // Process with sharp for metadata and optimization
                const metadata = await sharp(buffer).metadata();
                const processedBuffer = await sharp(buffer)
                    .resize(800, 600, { 
                        fit: 'inside',
                        withoutEnlargement: true 
                    })
                    .jpeg({ quality: 85 })
                    .toBuffer();
                
                const sizeKB = (buffer.length / 1024).toFixed(2);
                
                await thread.send({
                    content: `🖼️ **${image.name}**\n📏 ${metadata.width}×${metadata.height} | 💾 ${sizeKB} KB`,
                    files: [new AttachmentBuilder(processedBuffer, { 
                        name: `processed_${image.name.replace(/\.[^/.]+$/, '')}.jpg` 
                    })]
                });
                
            } catch (error) {
                this.logger.error(`Error processing image ${image.name}:`, error);
                await thread.send(`❌ Could not process: ${image.name}`);
            }
        }
    }
    
    async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            this.logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }
}

// Start the bot
const bot = new DiscordGitHubBot();
bot.start();