# Persistent Memory System

Sunny now includes a comprehensive persistent memory system using MongoDB for data storage with automatic fallback to in-memory caching when MongoDB is not configured.

## Features

### 1. **Moderation History** (`Warning` model)
- Stores all warnings, timeouts, kicks, and bans
- Tracks offense count and escalation
- Automatic 30-day expiration for warnings
- Query by user, guild, time range, or action type

### 2. **Conversation Context** (`Conversation` model)
- Stores last 50 messages per channel
- Maintains context across bot restarts
- Auto-cleanup of inactive conversations (30+ days)
- Optional AI-generated context summaries

### 3. **User Preferences** (`UserPreference` model)
- Individual user settings and preferences
- Self-assigned role tracking
- Interaction count and analytics
- Custom user fields

### 4. **Server Settings** (`ServerSettings` model)
- Guild-specific configuration
- Moderation settings and thresholds
- Self-assignable roles list
- Welcome messages and logging channels

## Setup

### Option 1: MongoDB Atlas (Free - Recommended)

1. **Create Free MongoDB Atlas Cluster:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account
   - Create a free M0 cluster (512 MB)
   - Click "Connect" → "Connect your application"

2. **Get Connection String:**
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/sunny-bot
   ```

3. **Add to .env file:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sunny-bot
   ```

4. **Whitelist IP Address:**
   - In Atlas, go to "Network Access"
   - Add "0.0.0.0/0" to allow all IPs (or specific IPs for security)

### Option 2: Local MongoDB

1. **Install MongoDB:**
   ```bash
   # macOS
   brew install mongodb-community
   
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # Windows - Download from mongodb.com
   ```

2. **Start MongoDB:**
   ```bash
   mongod --dbpath /path/to/data
   ```

3. **Add to .env:**
   ```env
   MONGODB_URI=mongodb://localhost:27017/sunny-bot
   ```

### Option 3: No Configuration (In-Memory Fallback)

If `MONGODB_URI` is not set, Sunny will:
- Use in-memory caching for all data
- Lose data on restart
- Still function fully with all features
- Show warnings about lack of persistence

## Troubleshooting

### "MongoDB not connected - using fallback"
**Cause:** MONGODB_URI not set or connection failed  
**Fix:** Add valid MONGODB_URI to .env file

### "Failed to store in MongoDB"
**Cause:** MongoDB credentials invalid or cluster unreachable  
**Fix:** Verify connection string and network access in Atlas

### Data not persisting across restarts
**Cause:** Using in-memory fallback  
**Fix:** Configure MONGODB_URI in .env

For complete documentation, see the full file in the repository.
