# Sunny Bot - The Nook Discord Server

Sunny is a friendly AI admin and moderator for The Nook, a cozy autumn-themed Discord community where everyone is included.

## Features

- **Natural Conversation**: No slash commands - just talk to Sunny naturally by mentioning "Hey Sunny", using @mentions, or replying to her messages
- **Multi-Provider AI**: Supports Anthropic Claude and Z.AI GLM models with easy switching between providers
- **Smart Model Selection**: Automatically chooses between GLM-4.5-Air (efficient) and GLM-4.6 (advanced) based on conversation complexity
- **Real-Time Status Updates**: Live progress indicators show actual AI operations (model selection, API calls, tool execution)
- **Message History Visibility**: Sunny can now fetch and view Discord message history, including full embed content
- **Admin & Moderator**: Sunny manages the server with owner-authorized actions and autonomous moderation
- **75+ Discord Actions**: Complete server management including channels, roles, threads, forums, events, emojis, permissions, tickets, and automated messages
- **Role Management**: Self-assignable interest and pronoun roles with auto-creation
- **Conversation Context**: Remembers recent messages and can view channel history for natural, flowing conversations
- **Permission System**: Owner-only commands for sensitive actions, member-accessible for self-service
- **Interactive Games & Entertainment**: AI-powered trivia (19+ categories), Rock-Paper-Scissors, number guessing with button interactions
- **Persistent Memory System**: Long-term context retention for personalized interactions across sessions
- **Media Processing**: Image compression, resizing, and MP4→APNG conversion for Discord stickers/emojis
- **Cozy Autumn Vibes**: Warm, welcoming personality that matches The Nook's theme

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Discord account with server management permissions
- Anthropic Claude API key
- (Optional) MongoDB Atlas account

### 1. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it "Sunny"
3. Go to "Bot" section and click "Add Bot"
4. Enable these **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Copy the bot token
6. Go to OAuth2 → URL Generator:
   - Scopes: `bot`
   - Bot Permissions: Administrator (or specific permissions: Manage Channels, Manage Roles, Kick Members, Ban Members, Moderate Members, Send Messages, Manage Messages, Read Message History)
7. Use the generated URL to invite Sunny to your server

### 2. Get Your Discord User ID

1. Enable Developer Mode in Discord: Settings → Advanced → Developer Mode
2. Right-click your username and select "Copy User ID"
3. Save this ID - you'll need it for the `.env` file

### 3. Get AI Provider API Key

#### Option A: Anthropic Claude (Recommended for stability)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Go to API Keys and create a new key
4. Copy the key (starts with `sk-ant-api03-`)

#### Option B: Z.AI GLM (Recommended for cost savings)
1. Go to [Z.AI Console](https://console.z.ai/)
2. Create an account or sign in
3. Create a new API key
4. Copy the key

### 4. Install and Configure

```bash
# Clone or navigate to the project
cd sunny-bot

# Install dependencies
npm install

# Create environment file
cp config/.env.example .env

# Edit .env with your values
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_OWNER_ID=your_discord_user_id_here

# AI Provider Configuration
AI_PROVIDER=anthropic  # or 'zai'

# Anthropic Claude
CLAUDE_API_KEY=sk-ant-api03-your_api_key_here
CLAUDE_MODEL=claude-3-haiku-20240307  # or claude-3-5-haiku-20241022

# Z.AI (optional, for cost savings)
ZAI_API_KEY=your_zai_api_key_here
ZAI_MODEL=glm-4.5-air

MONGODB_URI=mongodb+srv://... (optional)
MODERATION_LEVEL=2
```

### 5. Run the Bot

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

You should see:
```
✅ Connected to MongoDB (or "Running without MongoDB")
🤖 Sunny is online and ready!
```

## Usage Examples

### Talking to Sunny

**Natural Mentions:**
```
User: Hey Sunny, can I get the Gamer role?
[Status Indicator: 🤖 AI Model Selected → Using GLM-4.5-Air (Efficient)]
[Status Indicator: 🔧 Executing Tool → Running: assign_role]
Sunny: You got it! I've added the Gamer role for you. You'll now see the #gaming-lounge channel!
```

**@Mentions:**
```
User: @Sunny what are the server rules?
[Status Indicator: 📤 Sending API Request → Processing your question...]
Sunny: You can find our community guidelines in #rules-and-info! The main ones are: be kind, keep content appropriate, and use channels correctly. 🍂
```

**Reply Function:**
```
Sunny: Welcome to The Nook! 🍂
User: [Replies to Sunny's message] Thanks! Can I get the Artist role?
Sunny: Of course! I've given you the Artist role. Check out #creative-corner!
```

**View Message History:**
```
User: Sunny, can you see all embeds in the #announcements channel?
[Status Indicator: 🔧 Executing Tool → Running: get_channel_messages]
Sunny: Yes! I can see 5 embeds in #announcements:
1. Welcome Message (posted by @Admin)
2. Server Rules Update (posted by @Sunny)
...
```

**AI-Powered Trivia:**
```
User: Hey Sunny, start a trivia game about music!
[Status Indicator: 🤖 AI Model Selected → Using GLM-4.6 (Advanced)]
Sunny: 🎵 **Music Trivia - Medium Difficulty**

Which band released the album "The Dark Side of the Moon" in 1973?
A) Led Zeppelin
B) Pink Floyd
C) The Beatles
D) The Rolling Stones

(Questions are AI-generated and never repeat!)
```

### Owner Commands

Only the server owner (you) can request these:

```
You: Hey Sunny, can you create a new channel called #music-share?
Sunny: Done! I've created #music-share for you.

You: Sunny, please ban @spammer
Sunny: I've banned that member. They won't be able to return unless unbanned.
```

If a regular member tries:
```
Member: Sunny, delete the #general channel
Sunny: I can only do that when [Your Name] asks me to! It's to keep the server safe and organized. Is there something else I can help you with?
```

## AI Provider Options

Sunny supports multiple AI providers with easy switching. Choose based on your needs:

### Quick Comparison

| Provider | Model | Input Cost | Output Cost | Monthly Est.* | Best For |
|----------|-------|-----------|-------------|--------------|----------|
| **Anthropic** | Claude 3.5 Haiku | $0.80/1M | $4.00/1M | $10-30 | Current (baseline) |
| **Anthropic** | Claude 3 Haiku | $0.25/1M | $1.25/1M | $3-8 | **73% savings** |
| **Z.AI** | GLM-4.5-Air | $0.20/1M | $1.10/1M | $2-6 | **81% savings** |
| **Z.AI** | GLM-4.5 | $0.60/1M | $2.20/1M | $7-20 | Premium features |

*Monthly estimates for typical Discord bot usage (<100 active members)

### Option 1: Anthropic Claude (Default)

**Recommended for:** Stability, proven reliability, official support

**Available Models:**
- `claude-3-5-haiku-20241022` - Current default, good balance
- `claude-3-haiku-20240307` - **Save 73%**, older but capable

**Pros:**
- ✅ Proven stability and reliability
- ✅ Official Anthropic support
- ✅ Excellent documentation
- ✅ Prompt caching (90% savings on repeated context)
- ✅ Well-tested in production

**Cons:**
- ❌ More expensive than Z.AI
- ❌ 3 Haiku is older (March 2024)

**Setup:**
```env
AI_PROVIDER=anthropic
CLAUDE_API_KEY=sk-ant-api03-your_key_here
CLAUDE_MODEL=claude-3-haiku-20240307  # or claude-3-5-haiku-20241022
```

### Option 2: Z.AI GLM (Cost Optimized) ⭐

**Recommended for:** Maximum cost savings, excellent tool-calling

**Available Models:**
- `glm-4.5-air` - **Recommended**, best value (81% savings)
- `glm-4.5` - More powerful, still cheaper than Claude
- `glm-4.6` - Latest version

**Pros:**
- ✅ **90.6% tool-calling success rate** (beats Claude 4 Sonnet!)
- ✅ **81% cost savings** over Claude 3.5 Haiku
- ✅ Designed specifically for agentic workflows
- ✅ 2x faster than GLM-4.5 (217.5 tokens/sec)
- ✅ 128K context window
- ✅ OpenAI-compatible API (easy integration)
- ✅ Hybrid thinking modes (thinking + instant)

**Cons:**
- ⚠️ U.S. Entity List restriction (check if applicable)
- ⚠️ Less proven in production than Claude
- ⚠️ Newer provider (less community support)

**Setup:**
```env
AI_PROVIDER=zai
ZAI_API_KEY=your_zai_api_key_here
ZAI_MODEL=glm-4.5-air
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
```

**Get API Key:** https://console.z.ai/

### Switching Providers

Change providers instantly without code changes:

```bash
# Switch to Claude 3 Haiku (73% savings)
echo "AI_PROVIDER=anthropic" >> .env
echo "CLAUDE_MODEL=claude-3-haiku-20240307" >> .env
npm restart

# Switch to Z.AI (81% savings)
echo "AI_PROVIDER=zai" >> .env
echo "ZAI_MODEL=glm-4.5-air" >> .env
npm restart
```

### Performance Comparison

**Tool Calling Success Rate:**
- GLM-4.5-Air: **90.6%** 🏆
- Claude 4 Sonnet: 89.5%
- Claude 3.5 Haiku: ~85%

**Response Speed:**
- GLM-4.5-Air: **217.5 tokens/sec** ⚡
- GLM-4.5: ~100 tokens/sec
- Claude 3.5 Haiku: ~80-100 tokens/sec

**Global Rankings:**
- GLM-4.5: Ranked 3rd globally (12 benchmarks)
- GLM-4.5-Air: Ranked 6th globally
- Beats: Gemini 2.5 Flash, Qwen3-235B

### Migration Guide

See [MIGRATION_TEST_CHECKLIST.md](MIGRATION_TEST_CHECKLIST.md) for comprehensive testing before switching providers.

**Recommended Strategy:**
1. **Phase 1 (5 mins):** Switch to Claude 3 Haiku → Save 73% immediately
2. **Test for 1 week:** Monitor quality and performance
3. **Phase 2 (optional):** Migrate to Z.AI GLM-4.5-Air → Save 81% total
4. **Rollback anytime:** Just change `AI_PROVIDER` in `.env`

**Zero-downtime rollback** is always available!

## Recent Updates

### v2.2.0 - Real-Time Status & Message History (January 2025)
- ✨ **Real-Time Event-Driven Status**: Live progress shows actual operations (model selection, API calls, tool execution) with EventEmitter architecture
- 📜 **Message History Tool**: Fetch and view Discord messages with complete embed data (title, description, fields, colors, images)
- 🔍 **AI Provider Identification**: Ask Sunny which AI model she's currently using
- ⏱️ **Hang Detection System**: Removed time limits, added intelligent hang detection for better reliability

### v2.1.0 - Smart AI & Enhanced Gaming (January 2025)
- 🎯 **Smart Model Selection**: Auto-switches between GLM-4.5-Air (efficient) and GLM-4.6 (advanced) based on complexity
- 🎮 **AI-Powered Trivia**: Generate unique questions across 19+ categories that never repeat
- 🏆 **Enhanced Trivia System**: Multi-question sessions, leaderboards, progressive message cleanup
- 🎲 **Interactive Games**: Rock-Paper-Scissors, number guessing, trivia with button interactions

### v2.0.0 - Multi-Provider Architecture (December 2024)
- 🤖 **Z.AI GLM Integration**: Added support for Z.AI's GLM models (73-81% cost savings)
- 🔄 **Provider Switching**: Easy runtime switching between Anthropic and Z.AI
- 💰 **Cost Optimization**: Smart model selection reduces costs dramatically
- 📊 **Dynamic Response Length**: Adjusts response complexity based on message complexity

### v1.9.0 - Advanced Discord Features (November 2024)
- 🧠 **Persistent Memory System**: Long-term context retention across sessions
- 🎫 **Thread-Based Ticketing**: Interactive ticket system with modal forms and button panels
- 📨 **Automatic Messages**: Scheduled/triggered automated messaging system
- 🎨 **Media Processing**: Image compression, resizing, MP4→APNG conversion for stickers/emojis
- 📸 **Attachment Vision**: See and use image attachments for sticker/emoji creation

### v1.8.0 - Production Enhancements (October 2024)
- ⏰ **Time-Based Completion**: Replaced iteration limits with intelligent time-based system (7min timeout)
- 🎨 **Autumn-Themed Status**: Visually stunning real-time status indicator with autumn aesthetics
- 🔧 **75+ Discord Tools**: Fixed buggy tools, implemented 11 missing Discord actions
- 📝 **Smart Message Splitting**: Automatic splitting for Discord's 2000/4000 char limits
- 🛡️ **Bot Whitelist**: Prevent conflicts with other bots
- 🔄 **Reaction Roles**: MongoDB-backed persistent reaction role system

## Project Structure

```
sunny-bot/
├── config/
│   ├── .env.example          # Environment variables template
│   ├── config.json           # Bot configuration
│   ├── personality.txt       # Sunny's personality prompt
│   └── rules.json            # Server rules and moderation settings
├── src/
│   ├── index.js              # Main bot entry point
│   ├── handlers/
│   │   ├── messageHandler.js    # Message processing with status tracking
│   │   └── memberHandler.js     # Welcome/goodbye messages
│   ├── services/
│   │   ├── agentService.js      # Agent facade layer
│   │   ├── contextService.js    # Conversation context
│   │   ├── roleService.js       # Role management
│   │   ├── statusService.js     # Real-time status indicator
│   │   └── providers/
│   │       ├── aiProviderFactory.js  # Multi-provider architecture
│   │       ├── zaiProvider.js        # Z.AI GLM integration
│   │       └── claudeProvider.js     # Anthropic Claude integration
│   ├── tools/
│   │   ├── toolExecutor.js      # 75+ Discord tools including message fetching
│   │   └── categories/          # Tool definitions by category
│   └── utils/
│       ├── logger.js            # Winston logging
│       ├── permissions.js       # Permission checks
│       └── triggerDetection.js  # Trigger detection
├── logs/                     # Log files (auto-created)
├── package.json
└── README.md
```

## Configuration

### config/config.json

Main bot configuration including:
- Trigger phrases for natural mentions
- Self-assignable roles and permissions
- Moderation settings and timeout durations
- Channel mappings
- Welcome/goodbye messages
- Claude API settings

### config/personality.txt

Sunny's personality, communication style, and action guidelines. Edit this to customize how Sunny responds and behaves.

### config/rules.json

Server rules, moderation guidelines, and auto-moderation settings. Includes rule descriptions, severity levels, and automated moderation thresholds.

### .env

Sensitive configuration (tokens, keys, IDs). **Never commit this file to version control.**

## Self-Assignable Roles

Members can request these roles from Sunny:

**Interest Roles:**
- 🎨 Artist (unlocks #creative-corner)
- 🎮 Gamer (unlocks #gaming-lounge)
- 📚 Reader/Writer (unlocks #library)
- 🎵 Music Lover (unlocks #music-corner)
- 🎬 Movie Buff (unlocks #movie-night)
- 🦉 Night Owl
- 🐦 Early Bird
- 📷 Photographer (unlocks #photo-gallery)
- ✂️ Crafter (unlocks #craft-corner)

**Pronoun Roles:**
- 💜 she/her
- 💙 he/him
- 💚 they/them
- 🧡 any pronouns

## Moderation

Sunny has three levels of moderation permissions:

### 1. Owner-Only (You)
- Creating/deleting/renaming channels
- Banning/unbanning members
- Server settings changes
- Managing other members' roles

### 2. Autonomous (Sunny Decides)
- Timing out disruptive members (max 24h)
- Issuing warnings
- Deleting spam/harmful messages
- Moving conversations to correct channels

### 3. Member-Accessible (Anyone)
- Self-assignable role requests
- Server info and rules
- Channel suggestions
- General conversation

## Monitoring

Logs are stored in `logs/` directory:
- `error.log` - Errors and critical issues
- `combined.log` - All activity
- Console output shows real-time activity

Monitor Sunny's actions in your Discord server's #mod-logs channel (auto-created).

## Pushing to GitHub

Before deploying, you'll need to push your code to GitHub:

```bash
# If you haven't initialized git yet:
git init
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Stage and commit all files
git add .
git commit -m "Initial commit: Sunny Discord Bot"

# Push to GitHub
# You'll need to authenticate with GitHub
# Option 1: Use GitHub CLI (recommended)
gh auth login
git push -u origin master

# Option 2: Use Personal Access Token
# Create a token at https://github.com/settings/tokens
# Then use it as your password when prompted
git push -u origin master
```

**Important:** Make sure `.env` is in your `.gitignore` file (it should be by default) to keep your tokens secure!

## Deployment Options

### Option 1: Render.com (Recommended - Easy Setup)

Free tier with 750 hours/month. **Important:** Free web services spin down after 15 minutes of inactivity and wake up on the next request.

#### Quick Deploy:

1. **Push code to GitHub** (see instructions below)
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** sunny-bot
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Add environment variables:
   - `DISCORD_TOKEN` (from Discord Developer Portal)
   - `DISCORD_OWNER_ID` (your Discord user ID)
   - `DISCORD_SERVER_ID` (your server ID)
   - `CLAUDE_API_KEY` (from Anthropic Console)
   - `MODERATION_LEVEL` = `2`
7. Click "Create Web Service"

The bot includes a health check endpoint at `/health` to keep it alive on Render's free tier.

**Note:** The free tier spins down after 15 minutes of inactivity, which may cause brief delays in bot responses. For 24/7 uptime, upgrade to a paid plan ($7/month).

### Option 2: Fly.io

Free tier includes 3 shared VMs with 256MB RAM each.

```bash
# Install Fly CLI
# Windows: https://fly.io/docs/hands-on/install-flyctl/

# Login
fly auth login

# Launch app (follow prompts)
fly launch

# Set secrets
fly secrets set DISCORD_TOKEN=your_token_here
fly secrets set DISCORD_OWNER_ID=your_id_here
fly secrets set CLAUDE_API_KEY=your_key_here

# Deploy
fly deploy

# View logs
fly logs
```

### Option 3: Railway.app

Free tier includes 500 hours/month.

1. Connect GitHub repo to Railway
2. Add environment variables in dashboard
3. Deploy automatically on push

### Option 4: VPS (DigitalOcean, Linode, etc.)

```bash
# SSH into server
ssh user@your-server

# Install Node.js, clone repo, configure
# Use PM2 for process management
npm install -g pm2
pm2 start src/index.js --name sunny-bot
pm2 startup
pm2 save
```

## Troubleshooting

### Bot won't start

**"Invalid token" error:**
- Verify `DISCORD_TOKEN` in `.env` is correct
- Regenerate token in Discord Developer Portal if needed

**"Missing intents" error:**
- Enable Message Content Intent in Developer Portal → Bot → Privileged Gateway Intents

**"Cannot find module" errors:**
- Run `npm install` to install dependencies

### Bot doesn't respond

**Check these:**
1. Bot has "Administrator" permission or at minimum "Read Messages", "Send Messages", "Manage Roles"
2. Message Content Intent is enabled in Developer Portal
3. You're using correct trigger phrases: "Hey Sunny", @mention, or replying to Sunny's messages
4. Check logs in `logs/combined.log` for errors

### Commands don't work

**Owner commands fail:**
- Verify `DISCORD_OWNER_ID` in `.env` matches your Discord User ID exactly
- Make sure you're using natural language: "Hey Sunny, create a channel called music" not "/create channel"

**Role assignment fails:**
- Ensure roles exist in Discord server with exact names from config
- Sunny's role must be higher than roles she's assigning
- Check Sunny has "Manage Roles" permission

## AI Model Information

### Multi-Provider Architecture

Sunny now supports **intelligent model selection** with cost optimization:

**Z.AI GLM (Recommended for Cost Savings):**
- **Smart Selection**: Automatically picks between GLM-4.5-Air (efficient) and GLM-4.6 (advanced) based on message complexity
- **GLM-4.5-Air**: 81% cost savings, 90.6% tool-calling success rate, 217.5 tokens/sec
- **GLM-4.6**: Latest model for complex reasoning and advanced tasks
- **Cost**: $0.20-0.60/1M input, $1.10-2.20/1M output
- **Best For**: Production Discord bots with high message volume

**Anthropic Claude:**
- **Claude 3 Haiku**: 73% cost savings, reliable and proven
- **Claude 3.5 Haiku**: Current generation, excellent balance
- **Claude Sonnet 4.5**: Most advanced agentic workflows (not required for typical usage)
- **Cost**: $0.25-3.00/1M input, $1.25-15.00/1M output
- **Best For**: Maximum reliability and official support

**Model Selection Logic (Z.AI):**
```javascript
// Simple messages → GLM-4.5-Air (fast, cheap)
"Hey Sunny, how are you?"

// Complex operations → GLM-4.6 (advanced)
"Create a new channel, set permissions, and announce it in #general"
```

**Change Models:**
```env
# Z.AI with smart selection (recommended)
AI_PROVIDER=zai
ZAI_MODEL=glm-4.5-air  # Default for simple tasks

# Claude Haiku (stable)
AI_PROVIDER=anthropic
CLAUDE_MODEL=claude-3-haiku-20240307
```

## Cost Information

**Discord Bot:** Free

**AI Provider Costs (Pay-as-you-go):**

*Z.AI GLM (Recommended):*
- GLM-4.5-Air: $0.20/1M input, $1.10/1M output
- GLM-4.6: $0.60/1M input, $2.20/1M output
- Smart selection saves 73-81% vs Claude

*Anthropic Claude:*
- Claude 3 Haiku: $0.25/1M input, $1.25/1M output
- Claude 3.5 Haiku: $0.80/1M input, $4.00/1M output
- With prompt caching: 90% savings on repeated content

**MongoDB Atlas:** Free tier (512MB storage)
**Hosting:** Free tier on Fly.io, Railway, Render

**Estimated Monthly Costs:**
- Z.AI GLM: **$2-6/month** (small server <100 members)
- Claude 3 Haiku: **$3-8/month**
- Claude 3.5 Haiku: **$10-30/month**

## Support

For issues, questions, or suggestions:
1. Check logs in `logs/` directory
2. Review Discord Developer Portal bot configuration
3. Verify all environment variables in `.env`
4. Check Sunny's role position and permissions in Discord

## License

MIT License - Feel free to modify and use for your own Discord servers!

---

Made with 🍂 for The Nook community
