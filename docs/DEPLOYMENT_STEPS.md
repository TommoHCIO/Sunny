# Z.AI Provider Migration - Deployment Steps

## ⚠️ CRITICAL: Missing Dependency Added

**IMPORTANT**: The `openai` package was missing from `package.json` and has now been added. You **MUST** run `npm install` before testing the Z.AI provider.

## Quick Start (Choose One Path)

### Path A: Quick Win - Claude 3 Haiku (5 minutes, 73% savings)
```bash
# 1. Install dependencies
npm install

# 2. Update .env file
AI_PROVIDER=anthropic
CLAUDE_MODEL=claude-3-haiku-20240307

# 3. Restart bot
npm start
```

### Path B: Maximum Savings - Z.AI GLM-4.5-Air (81% savings)
```bash
# 1. Install dependencies (includes openai package)
npm install

# 2. Get Z.AI API key from https://z.ai/
# Sign up and generate API key

# 3. Update .env file
AI_PROVIDER=zai
ZAI_API_KEY=your_zai_api_key_here
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
ZAI_MODEL=glm-4.5-air
ZAI_MAX_TOKENS=3000
ZAI_TEMPERATURE=0.7

# 4. Deploy to Render or test locally
npm start
```

## Pre-Deployment Checklist

### ✅ Code Changes Complete
- [x] Created `src/services/aiProviderFactory.js` - Factory pattern for provider selection
- [x] Created `src/services/providers/anthropicProvider.js` - Extracted existing Claude logic
- [x] Created `src/services/providers/zaiProvider.js` - New Z.AI implementation
- [x] Modified `src/services/agentService.js` - Now acts as facade
- [x] Created `src/utils/costTracker.js` - Cost monitoring utility
- [x] Updated `.env.example` - Added all provider configuration
- [x] Updated `README.md` - Added AI Provider Options section
- [x] Added `openai` package to `package.json` ⚠️ **NEW**

### ⚠️ Required Before Testing
- [ ] Run `npm install` to install `openai` package
- [ ] Copy `.env.example` to `.env` if not exists
- [ ] Choose provider (anthropic or zai) and configure in `.env`
- [ ] If using Z.AI: Get API key from https://z.ai/

### 📋 Testing Checklist
- [ ] Follow `MIGRATION_TEST_CHECKLIST.md` (100+ test cases)
- [ ] Test basic message responses
- [ ] Test tool calling (stickers, emojis, channels)
- [ ] Test multi-step workflows (tickets, trivia)
- [ ] Test error handling
- [ ] Monitor costs using `costTracker.js`

## Deployment to Render

### Option 1: Environment Variables Only (Recommended)
```bash
# In Render dashboard, add/update these environment variables:
AI_PROVIDER=zai
ZAI_API_KEY=<your-key>
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
ZAI_MODEL=glm-4.5-air
ZAI_MAX_TOKENS=3000
ZAI_TEMPERATURE=0.7

# Trigger redeploy - Render will auto-run npm install
```

### Option 2: Git Push
```bash
# Stage all changes
git add .

# Commit
git commit -m "feat: Add multi-provider AI architecture with Z.AI GLM support

Implemented provider abstraction layer supporting both Anthropic Claude
and Z.AI GLM models for 73-81% cost savings.

Changes:
- Added provider factory pattern for dynamic AI provider selection
- Created anthropicProvider.js preserving existing Claude functionality
- Created zaiProvider.js with OpenAI SDK for Z.AI GLM-4.5-Air
- Added openai package dependency for Z.AI compatibility
- Modified agentService.js to delegate to providers
- Added costTracker.js for monitoring API costs
- Updated documentation with migration guides

Cost savings:
- Claude 3 Haiku: 73% savings vs Claude 3.5 Haiku
- Z.AI GLM-4.5-Air: 81% savings with 90.6% tool-calling success

🤖 Generated with Claude Code"

# Push to trigger Render auto-deploy
git push origin master
```

## Rollback Plan

If issues occur with Z.AI, instant rollback:

```bash
# In Render dashboard or .env:
AI_PROVIDER=anthropic

# Render will redeploy automatically
# Or restart locally: npm start
```

## Cost Monitoring

```javascript
// In your bot logs, you'll see:
const { getCostReport, compareModels } = require('./src/utils/costTracker');

// Get current session costs
console.log(getCostReport());

// Compare savings
console.log(compareModels('claude-3-5-haiku-20241022', 'glm-4.5-air'));
```

## Success Criteria

✅ Bot responds to messages
✅ Tool calling works (stickers, emojis, channels, etc.)
✅ Multi-step workflows complete (tickets, trivia games)
✅ Error messages are helpful
✅ Response quality matches previous model
✅ Cost tracking shows expected savings

## Troubleshooting

### Bot won't start after npm install
**Cause**: Missing environment variables
**Fix**: Check `.env` has `AI_PROVIDER` and required keys

### "Unknown AI provider" error
**Cause**: AI_PROVIDER not set or invalid
**Fix**: Set to `anthropic` or `zai`

### Z.AI "API key invalid" error
**Cause**: Missing or incorrect ZAI_API_KEY
**Fix**: Get valid key from https://z.ai/ dashboard

### Tool calling fails with Z.AI
**Cause**: Tool schema conversion issue
**Fix**: Check `convertToolsToOpenAIFormat()` in zaiProvider.js

### Response quality degraded
**Cause**: Model not suitable for task
**Fix**:
- Try GLM-4.5 instead of GLM-4.5-Air
- Adjust ZAI_TEMPERATURE (try 0.5-0.9)
- Rollback to Anthropic provider

### "Cannot find module 'openai'" error
**Cause**: openai package not installed
**Fix**: Run `npm install` (this was the missing dependency)

## Files Changed Summary

### New Files
- `src/services/aiProviderFactory.js` - Provider factory
- `src/services/providers/anthropicProvider.js` - Claude provider
- `src/services/providers/zaiProvider.js` - Z.AI provider
- `src/utils/costTracker.js` - Cost monitoring
- `MIGRATION_TEST_CHECKLIST.md` - Testing guide
- `MIGRATION_SUMMARY.md` - Technical details
- `DEPLOYMENT_STEPS.md` - This file

### Modified Files
- `package.json` - Added `openai` dependency ⚠️ **CRITICAL**
- `src/services/agentService.js` - Now facade pattern
- `.env.example` - Added provider configs
- `README.md` - Added AI Provider Options section

## Next Steps

1. **Immediate**: Run `npm install` to get `openai` package
2. **Decision**: Choose Path A (Claude 3 Haiku) or Path B (Z.AI)
3. **Configure**: Update `.env` with chosen provider settings
4. **Test Locally**: Run bot locally and test basic features
5. **Full Testing**: Complete `MIGRATION_TEST_CHECKLIST.md`
6. **Deploy**: Push to Render or update environment variables
7. **Monitor**: Watch logs and cost tracking for first 24 hours
8. **Optimize**: Adjust settings if needed (temperature, model)

## Support

- Migration testing guide: `MIGRATION_TEST_CHECKLIST.md`
- Technical architecture: `MIGRATION_SUMMARY.md`
- Provider options: See `README.md` "AI Provider Options" section
- Z.AI docs: https://z.ai/docs
- Anthropic docs: https://docs.anthropic.com

---

**Remember**: The `openai` package was just added to `package.json`. Run `npm install` before testing!
