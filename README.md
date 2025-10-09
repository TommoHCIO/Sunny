# Sunny Bot - The Nook Discord Server

Sunny is a friendly AI admin and moderator for The Nook, a cozy autumn-themed Discord community where everyone is included.

## Features

- **Natural Conversation**: No slash commands - just talk to Sunny naturally by mentioning "Hey Sunny", using @mentions, or replying to her messages
- **Admin & Moderator**: Sunny manages the server with owner-authorized actions and autonomous moderation
- **Role Management**: Self-assignable interest and pronoun roles
- **Conversation Context**: Remembers recent messages for natural, flowing conversations
- **Permission System**: Owner-only commands for sensitive actions, member-accessible for self-service
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

### 3. Get Claude API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Go to API Keys and create a new key
4. Copy the key (starts with `sk-ant-api03-`)

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
CLAUDE_API_KEY=sk-ant-api03-your_api_key_here
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
Sunny: You got it! I've added the Gamer role for you. You'll now see the #gaming-lounge channel!
```

**@Mentions:**
```
User: @Sunny what are the server rules?
Sunny: You can find our community guidelines in #rules-and-info! The main ones are: be kind, keep content appropriate, and use channels correctly. 🍂
```

**Reply Function:**
```
Sunny: Welcome to The Nook! 🍂
User: [Replies to Sunny's message] Thanks! Can I get the Artist role?
Sunny: Of course! I've given you the Artist role. Check out #creative-corner!
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
│   │   ├── messageHandler.js    # Message processing
│   │   └── memberHandler.js     # Welcome/goodbye messages
│   ├── services/
│   │   ├── claudeService.js     # Claude API integration
│   │   ├── contextService.js    # Conversation context
│   │   └── roleService.js       # Role management
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

## Cost Information

**Discord Bot:** Free
**Claude API:** Pay-as-you-go (approximately $0.003 per message with caching)
**MongoDB Atlas:** Free tier (512MB storage)
**Hosting:** Free tier available on Fly.io, Railway, Render

Estimated cost for small server (<100 active members): **$5-15/month** for Claude API only.

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
