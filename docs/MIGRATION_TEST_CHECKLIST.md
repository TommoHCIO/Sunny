# Z.AI Migration Testing Checklist

This checklist ensures all Sunny bot features work correctly after migrating to Z.AI GLM-4.5-Air.

## Pre-Migration Setup

- [ ] Install OpenAI SDK: `npm install openai@^4.0.0`
- [ ] Get Z.AI API key from https://console.z.ai/
- [ ] Add Z.AI configuration to `.env`
- [ ] Set `AI_PROVIDER=anthropic` initially (test Phase 1 first)

---

## Phase 1: Claude 3 Haiku Testing (Quick Win)

**Goal:** Verify 73% cost savings with older Claude model

### Configuration
- [ ] Set `CLAUDE_MODEL=claude-3-haiku-20240307` in `.env`
- [ ] Restart bot: `npm start`
- [ ] Verify bot connects successfully

### Basic Tests
- [ ] Bot responds to "Hey Sunny, how are you?"
- [ ] Personality intact (autumn theme, friendly, emojis)
- [ ] Response time < 3 seconds
- [ ] No error messages in console

### Quality Check (24-48 hours)
- [ ] Monitor conversation quality
- [ ] Check for degraded reasoning
- [ ] Compare responses to 3.5 Haiku
- [ ] Get user feedback

**Decision Point:** If quality acceptable, save 73% and optionally proceed to Phase 2

---

## Phase 2: Z.AI GLM-4.5-Air Testing (Maximum Savings)

**Goal:** Verify 81% cost savings with Z.AI provider

### Configuration
- [ ] Set `AI_PROVIDER=zai` in `.env`
- [ ] Set `ZAI_API_KEY=your_key` in `.env`
- [ ] Set `ZAI_MODEL=glm-4.5-air` in `.env`
- [ ] Restart bot: `npm start`
- [ ] Check console for "[Z.AI] Starting agentic loop" messages

---

## Test Suite 1: Basic Functionality

### Startup & Health
- [ ] Bot starts without errors
- [ ] Logs show "Using AI Provider: zai"
- [ ] Bot comes online in Discord
- [ ] No authentication errors

### Simple Conversations
- [ ] "Hey Sunny, hello!" → Friendly greeting response
- [ ] "Hey Sunny, what can you do?" → Feature list
- [ ] "Hey Sunny, what's your name?" → Self-introduction
- [ ] Response time < 2 seconds average
- [ ] Autumn theme and personality intact

### Context & Memory
- [ ] Multi-turn conversation maintains context
- [ ] Bot remembers previous messages in conversation
- [ ] Cross-channel context works (if enabled)

---

## Test Suite 2: Single Tool Execution

### Information Retrieval (Read-Only)
- [ ] `list_channels` - Lists all channels correctly
- [ ] `list_roles` - Lists all roles with details
- [ ] `list_members` - Lists server members
- [ ] `get_channel_info` - Shows channel details
- [ ] `get_role_info` - Shows role details
- [ ] `get_member_info` - Shows member details

### Channel Management
- [ ] `create_channel` - Creates text channel successfully
- [ ] `create_voice_channel` - Creates voice channel
- [ ] `modify_channel` - Updates channel name/topic
- [ ] `delete_channel` - Removes channel (test channel only!)
- [ ] `set_channel_permissions` - Updates permissions

### Role Management
- [ ] `create_role` - Creates new role
- [ ] `modify_role` - Updates role name/color/permissions
- [ ] `delete_role` - Removes role (test role only!)
- [ ] `assign_role` - Adds role to member
- [ ] `remove_role` - Removes role from member

### Messaging
- [ ] `send_message` - Sends message to specified channel
- [ ] `send_dm` - Sends direct message
- [ ] `send_embed` - Sends embedded message
- [ ] `edit_message` - Modifies existing message
- [ ] `delete_message` - Removes message

---

## Test Suite 3: Multi-Step Agentic Workflows

### Complex Setup: Reaction Roles
- [ ] User: "Hey Sunny, set up reaction roles in #roles"
- [ ] Bot should:
  1. List available roles (inspect)
  2. Create embedded message (send)
  3. Add reactions to message (react)
  4. Confirm setup complete
- [ ] Verify all steps execute in sequence
- [ ] Verify reaction role works

### Complex Setup: Welcome System
- [ ] User: "Hey Sunny, create a welcome system"
- [ ] Bot should:
  1. Check for welcome channel
  2. Create if missing
  3. Set up welcome message
  4. Configure permissions
- [ ] Verify multi-step execution

### Complex Setup: Moderation Flow
- [ ] User: "Hey Sunny, check if @TestUser has warnings"
- [ ] Bot should:
  1. Look up member
  2. Check warning history
  3. Report findings
- [ ] Verify data extraction between steps

### Error Recovery
- [ ] Test invalid channel name → Bot recovers gracefully
- [ ] Test permission denied → Bot explains clearly
- [ ] Test missing role → Bot suggests creation

---

## Test Suite 4: Games & Entertainment

### Trivia System
- [ ] "Sunny start a trivia game" → Game starts
- [ ] Answer questions with buttons
- [ ] Multiple players can join
- [ ] Leaderboard displays at end
- [ ] Scores tracked correctly

### Polls
- [ ] "Sunny create a poll: Pizza or Burgers?" → Poll created
- [ ] Native Discord poll format
- [ ] Options display correctly
- [ ] Quick polls (Yes/No/Maybe buttons)

### Mini-Games
- [ ] "Sunny play rock paper scissors" → RPS game starts
- [ ] "Sunny roll a dice" → Dice roll result
- [ ] "Sunny flip a coin" → Heads or tails
- [ ] "Sunny guess a number" → Number guessing game

### Fun Features
- [ ] "Sunny tell me a fun fact" → Random fact
- [ ] "Sunny magic 8 ball: Will it rain?" → Magic 8-ball response

### Leaderboards
- [ ] "Sunny show the leaderboard" → Game scores display
- [ ] Scores accurate for all games

---

## Test Suite 5: Ticket System

### Ticket Creation
- [ ] Click "Create Ticket" button in support channel
- [ ] Modal form appears
- [ ] Fill out: category, subject, description, priority
- [ ] Ticket channel created
- [ ] Staff notified in control room
- [ ] Ticket embed displays correctly

### Ticket Management
- [ ] "Sunny close this ticket" → Ticket closes
- [ ] Transcript generated
- [ ] Transcript sent to configured channel
- [ ] Channel deleted or archived

### Ticket Listing
- [ ] "Sunny list all open tickets" → Shows active tickets
- [ ] Ticket details include creator info

---

## Test Suite 6: Moderation

### Warning System
- [ ] "Sunny warn @User for spamming" → Warning issued
- [ ] Warning logged to database
- [ ] User receives DM notification

### Timeout/Mute
- [ ] "Sunny timeout @User for 10 minutes" → User muted
- [ ] Timeout duration correct
- [ ] Auto-unmute after duration

### Kick/Ban
- [ ] "Sunny kick @TestUser" → User kicked (test user only!)
- [ ] "Sunny ban @TestUser" → User banned (test user only!)
- [ ] Audit log entry created

---

## Test Suite 7: Error Handling

### Invalid Inputs
- [ ] Non-existent channel name → Clear error message
- [ ] Invalid role ID → Helpful error
- [ ] Malformed command → Bot asks for clarification

### Permission Errors
- [ ] Non-owner tries owner-only command → Denied gracefully
- [ ] Bot lacks Discord permissions → Explains what's missing

### API Errors
- [ ] Network timeout → Retry logic works
- [ ] Rate limit hit → Backs off correctly
- [ ] Invalid API key → Clear configuration error

### Edge Cases
- [ ] Empty message → Bot prompts for input
- [ ] Very long message (10,000+ chars) → Handles gracefully
- [ ] Special characters in names → Processes correctly
- [ ] Concurrent requests → No race conditions

---

## Test Suite 8: Performance & Load

### Response Time
- [ ] Simple query: < 2 seconds
- [ ] Single tool use: < 3 seconds
- [ ] Multi-step workflow: < 10 seconds
- [ ] Complex trivia game: < 5 seconds per question

### Concurrent Users
- [ ] 3 users send commands simultaneously → All processed
- [ ] 5 users in trivia game → No conflicts
- [ ] 10 rapid-fire commands → Queue handles correctly

### Long Conversations
- [ ] 20-message conversation → Context maintained
- [ ] Context summarization works (if enabled)
- [ ] No memory leaks

### Tool Execution Marathon
- [ ] Execute 50 consecutive tool calls
- [ ] All succeed without degradation
- [ ] No timeout issues

---

## Test Suite 9: Cost & Monitoring

### Cost Tracking
- [ ] Check console logs for token usage
- [ ] Verify cost calculations are reasonable
- [ ] Compare to Claude 3 Haiku costs
- [ ] Monthly projection looks correct

### Performance Metrics
- [ ] Average response time logged
- [ ] Tool calling success rate > 85%
- [ ] Error rate < 5%
- [ ] Loop iterations reasonable (< 10 avg)

---

## Test Suite 10: Rollback Test

### Switch Back to Claude
- [ ] Set `AI_PROVIDER=anthropic` in `.env`
- [ ] Restart bot
- [ ] Verify bot still works with Claude
- [ ] All features functional
- [ ] No errors or degradation

**This confirms rollback capability works!**

---

## Acceptance Criteria

### Must Pass (Critical)
- ✅ Bot starts successfully with Z.AI
- ✅ All tool categories execute correctly
- ✅ Multi-step workflows complete
- ✅ Response quality acceptable
- ✅ Tool calling success rate > 85%
- ✅ Average response time < 3 seconds
- ✅ Error rate < 5%
- ✅ Rollback to Claude works

### Should Pass (Important)
- ✅ Games function properly
- ✅ Ticket system works
- ✅ Moderation tools effective
- ✅ Cost savings achieved (81%)
- ✅ No user complaints

### Nice to Have (Optional)
- ✅ Response time < 2 seconds average
- ✅ Zero errors for 24 hours
- ✅ Tool calling success rate > 90%
- ✅ User feedback positive

---

## Sign-Off

- [ ] All critical tests passed
- [ ] 1 week monitoring completed
- [ ] User feedback positive
- [ ] Cost savings confirmed
- [ ] Documentation updated
- [ ] Migration marked complete

**Date:** _________________  
**Tested By:** _________________  
**Approved By:** _________________  

---

## Rollback Procedure (If Needed)

If any critical tests fail:

1. Immediately set `AI_PROVIDER=anthropic` in `.env`
2. Restart bot: `npm restart`
3. Verify Claude works correctly
4. Document issues found
5. Plan fixes before retry

**Remember:** Zero downtime rollback is a feature, not a failure!
