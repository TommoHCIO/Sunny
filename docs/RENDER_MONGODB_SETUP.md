# Adding MongoDB Persistent Memory to Render.com Deployment

This guide shows how to add MongoDB persistent memory to Sunny's existing Render.com deployment.

## Prerequisites

- Sunny bot already deployed on Render.com
- Access to Render.com dashboard
- Access to MongoDB Atlas (free account)

---

## Step 1: Create MongoDB Atlas Free Cluster

### 1.1 Sign Up for MongoDB Atlas
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" and create an account
3. Choose the **FREE M0 cluster** (512 MB storage)

### 1.2 Create Cluster
1. Click "Build a Database"
2. Choose **M0 FREE** tier
3. Select cloud provider: **AWS** (recommended for Render compatibility)
4. Choose region closest to your Render service (check Render dashboard for region)
5. Name your cluster (e.g., "sunny-bot-cluster")
6. Click "Create"

### 1.3 Create Database User
1. In "Security" → "Database Access"
2. Click "+ ADD NEW DATABASE USER"
3. Choose "Password" authentication
4. Username: `sunny-bot` (or your choice)
5. **Auto-generate secure password** and **SAVE IT**
6. Database User Privileges: **Read and write to any database**
7. Click "Add User"

### 1.4 Configure Network Access
1. In "Security" → "Network Access"
2. Click "+ ADD IP ADDRESS"
3. Click "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0)
   - This is required for Render.com since IPs can change
   - Your database is still protected by username/password
4. Click "Confirm"

### 1.5 Get Connection String
1. Click "Database" in left sidebar
2. Click "Connect" button on your cluster
3. Choose "Connect your application"
4. Select **Node.js** driver and version **5.5 or later**
5. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add database name: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sunny-bot?retryWrites=true&w=majority`

**Example final connection string:**
```
mongodb+srv://sunny-bot:MySecurePassword123@cluster0.abc12.mongodb.net/sunny-bot?retryWrites=true&w=majority
```

---

## Step 2: Add MONGODB_URI to Render.com

### 2.1 Access Render Dashboard
1. Go to https://dashboard.render.com
2. Click on your **Sunny bot service**

### 2.2 Add Environment Variable
1. Click **"Environment"** in the left sidebar
2. Scroll to "Environment Variables" section
3. Click **"+ Add Environment Variable"** button
4. Enter the following:
   - **Key:** `MONGODB_URI`
   - **Value:** Your connection string from Step 1.5

### 2.3 Save and Deploy
1. Click **"Save Changes"** button
2. Render will **automatically redeploy** your service
3. Wait for deployment to complete (2-3 minutes)

---

## Step 3: Verify MongoDB Connection

### 3.1 Check Render Logs
1. In Render dashboard, click **"Logs"** tab
2. Look for successful connection message:
   ```
   ✅ Connected to MongoDB
   ```

### 3.2 If Connection Fails
Look for error messages:

**Error: "MongooseServerSelectionError"**
- **Cause:** Network access not configured
- **Fix:** Add 0.0.0.0/0 to MongoDB Atlas Network Access

**Error: "Authentication failed"**
- **Cause:** Wrong username/password
- **Fix:** Double-check credentials in connection string

**Error: "getaddrinfo ENOTFOUND"**
- **Cause:** Invalid cluster URL
- **Fix:** Verify connection string from Atlas dashboard

### 3.3 Test Persistent Memory
1. Send a message in Discord that triggers moderation (e.g., "you suck balls")
2. Check Sunny's response includes timeout
3. In Render logs, look for:
   ```
   ✅ Warning stored in MongoDB: userId in guild guildId
   ```
4. Restart the Render service (Manual Deploy → "Deploy latest commit")
5. Trigger moderation again - warning count should persist

---

## Step 4: Monitor Database Usage

### 4.1 MongoDB Atlas Dashboard
1. Go to MongoDB Atlas dashboard
2. Click your cluster
3. View **"Metrics"** tab:
   - Storage size
   - Number of documents
   - Operations per second

### 4.2 Render Logs
Look for cleanup messages every 6 hours:
```
🧹 Running database cleanup...
✅ Cleanup complete - Warnings: 5, Conversations: 2
📊 Database stats: { warnings: 42, conversations: 15, users: 28, servers: 1 }
```

---

## What Gets Stored in MongoDB

### Warning Collection
- All moderation warnings and timeouts
- Offense count and escalation history
- Expires after 30 days automatically

### Conversation Collection
- Last 50 messages per channel
- Maintains context across bot restarts
- Inactive conversations deleted after 30 days

### UserPreference Collection
- User settings and preferences
- Self-assigned role tracking
- Interaction count analytics

### ServerSettings Collection
- Guild-specific configuration
- Moderation settings and thresholds
- Custom server settings

---

## Free Tier Limits

MongoDB Atlas M0 (Free) Cluster:
- ✅ **512 MB storage** (sufficient for ~100K messages + warnings)
- ✅ **Unlimited connections**
- ✅ **Shared RAM and CPU**
- ✅ **Automatic backups** (manual restore)
- ✅ **No credit card required**

**Estimated Storage:**
- ~1 KB per warning → 500K warnings
- ~2 KB per conversation message → 250K messages
- Plenty for most Discord bots!

---

## Troubleshooting

### "MongoDB not connected - using fallback"
- **Check:** MONGODB_URI environment variable is set in Render
- **Check:** Connection string format is correct
- **Check:** Network access allows 0.0.0.0/0 in Atlas

### Data not persisting after restart
- **Check:** Render logs show "✅ Connected to MongoDB"
- **Check:** No authentication errors in logs
- **Check:** MONGODB_URI value doesn't have typos

### High memory usage in Render
- **Cause:** Large conversation history cached in memory
- **Fix:** This is normal - MongoDB offloads to disk
- **Monitor:** Render dashboard shows memory usage

### Connection timeouts
- **Cause:** MongoDB Atlas cluster paused (inactivity)
- **Fix:** Free tier clusters auto-pause after inactivity
- **Solution:** First request will wake it up (30s delay)

---

## Security Best Practices

✅ **DO:**
- Use strong database passwords
- Regularly rotate credentials
- Monitor Atlas logs for suspicious activity
- Use 0.0.0.0/0 for network access (required for Render)

❌ **DON'T:**
- Commit MONGODB_URI to Git (.env is already in .gitignore)
- Share your connection string publicly
- Use weak passwords like "password123"
- Hardcode credentials in source code

---

## Upgrading from Free Tier

If you need more storage or features:

**M2 Tier - $9/month:**
- 2 GB storage
- Dedicated RAM
- Faster performance

**M5 Tier - $25/month:**
- 5 GB storage
- More CPU power
- Better for high-traffic bots

To upgrade: MongoDB Atlas Dashboard → Cluster → "Upgrade" button

---

## Additional Resources

- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [Render.com Environment Variables](https://render.com/docs/configure-environment-variables)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Sunny Bot Persistent Memory Docs](./PERSISTENT_MEMORY.md)

---

## Summary Checklist

- [ ] Create MongoDB Atlas free cluster
- [ ] Create database user with password
- [ ] Configure network access (0.0.0.0/0)
- [ ] Get connection string
- [ ] Add MONGODB_URI to Render environment variables
- [ ] Wait for automatic redeploy
- [ ] Verify "✅ Connected to MongoDB" in logs
- [ ] Test moderation persistence across restarts
- [ ] Monitor database usage in Atlas dashboard

Once complete, Sunny will have **persistent memory across restarts**! 🎉
