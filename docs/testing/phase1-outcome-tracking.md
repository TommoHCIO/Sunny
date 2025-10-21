# Phase 1 Outcome Tracking System - Test Plan

**Version:** 1.0  
**Date:** 2025-10-21  
**Status:** Ready for Testing  

---

## Table of Contents

1. [Overview](#overview)
2. [Manual Test Scenarios](#manual-test-scenarios)
3. [Database Verification Queries](#database-verification-queries)
4. [Edge Cases](#edge-cases)
5. [Performance Checks](#performance-checks)
6. [Success Criteria](#success-criteria)
7. [Test Environment Setup](#test-environment-setup)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

This document provides a comprehensive test plan for Phase 1 of the AGI Learning System, which implements the data collection foundation for Sunny bot.

### Components Under Test

- **Outcome Model** (`src/models/Outcome.js`) - Tracks AI interaction outcomes
- **ToolExecution Model** (`src/models/ToolExecution.js`) - Tracks individual tool executions
- **OutcomeTracker Service** (`src/services/outcomeTracker.js`) - Records and analyzes outcomes
- **Metadata Cache** - 5-minute TTL map for execution metadata
- **Reaction Collectors** - 60-second window for user satisfaction feedback
- **Integration Points:**
  - `messageHandler.js` - Outcome recording integration
  - `toolExecutor.js` - Tool execution recording
  - `zaiProvider.js` - Metadata collection

### Testing Goals

1. Verify end-to-end outcome tracking works correctly
2. Ensure all tool executions are recorded with proper error classification
3. Validate user satisfaction capture via Discord reactions
4. Confirm graceful degradation when MongoDB is unavailable
5. Verify no performance impact on message response times

---

## Manual Test Scenarios

### Scenario 1: Simple Message Processing

**Objective:** Verify Outcome created with correct complexity classification.

**Steps:**
1. Send a simple message to Sunny: `Hello Sunny!`
2. Wait for response
3. Check Render logs for: `[OutcomeTracker] Recorded outcome: <id>`

**Expected Results:**
- Outcome created with `predictedComplexity: "GREETING"`
- `success: true`
- `iterations: 0` (no tools used)
- `toolsUsed: []`
- `modelUsed` should be `glm-4.5-air` or similar fast model
- Response time < 2 seconds

**Verification Query:**
```javascript
db.outcomes.findOne({
  userId: "<your_user_id>",
  predictedComplexity: "GREETING"
}).sort({ timestamp: -1 })
```

---

### Scenario 2: Complex Message with Tool Usage

**Objective:** Verify iterations and tools tracked correctly.

**Steps:**
1. Send a message requiring tools: `Can you list all channels in this server?`
2. Wait for response
3. Check logs for tool execution: `[ToolExecutor] Executing tool: list_channels`
4. Check logs for outcome recording

**Expected Results:**
- Outcome created with `predictedComplexity: "MODERATE"` or `"COMPLEX"`
- `iterations >= 1`
- `toolsUsed` contains `["list_channels"]`
- `toolCount >= 1`
- ToolExecution record created with:
  - `toolName: "list_channels"`
  - `success: true`
  - `duration` in milliseconds
  - Links to Outcome via `executionId`

**Verification Queries:**
```javascript
// Find the outcome
const outcome = db.outcomes.findOne({
  userId: "<your_user_id>",
  toolsUsed: "list_channels"
}).sort({ timestamp: -1 })

// Find linked tool execution
db.toolexecutions.find({
  executionId: outcome.executionId,
  toolName: "list_channels"
})
```

---

### Scenario 3: User Satisfaction - Thumbs Up

**Objective:** Verify positive reaction captured correctly.

**Steps:**
1. Send any message to Sunny
2. Wait for response
3. React with 👍 within 60 seconds
4. Check logs for: `📊 User reaction captured: 👍`
5. Wait for: `📊 Reaction collector ended (limit, time), recording outcome...`

**Expected Results:**
- Outcome record has:
  - `userSatisfaction: 1`
  - `userReacted: true`
- Reaction recorded within 60-second window

**Verification Query:**
```javascript
db.outcomes.findOne({
  userId: "<your_user_id>",
  userSatisfaction: 1,
  userReacted: true
}).sort({ timestamp: -1 })
```

---

### Scenario 4: User Satisfaction - Thumbs Down

**Objective:** Verify negative reaction captured correctly.

**Steps:**
1. Send any message to Sunny
2. Wait for response
3. React with 👎 within 60 seconds
4. Check logs for: `📊 User reaction captured: 👎`

**Expected Results:**
- Outcome record has:
  - `userSatisfaction: -1`
  - `userReacted: true`

**Verification Query:**
```javascript
db.outcomes.findOne({
  userId: "<your_user_id>",
  userSatisfaction: -1,
  userReacted: true
}).sort({ timestamp: -1 })
```

---

### Scenario 5: No Reaction - Timeout

**Objective:** Verify outcome saved with satisfaction=0 after 60s timeout.

**Steps:**
1. Send any message to Sunny
2. Wait for response
3. **Do NOT react** with any emoji
4. Wait 60 seconds
5. Check logs for: `📊 Reaction collector ended (time), recording outcome...`

**Expected Results:**
- Outcome record has:
  - `userSatisfaction: 0`
  - `userReacted: false`
- Outcome saved after 60-second timeout

**Verification Query:**
```javascript
db.outcomes.findOne({
  userId: "<your_user_id>",
  userSatisfaction: 0,
  userReacted: false
}).sort({ timestamp: -1 })
```

---

### Scenario 6: Permission Denied Tool

**Objective:** Verify ToolExecution error recorded with correct classification.

**Steps:**
1. As a **non-owner** user, send: `Sunny, delete the general channel`
2. Wait for permission denied response
3. Check logs for error recording

**Expected Results:**
- Sunny responds with permission denied message
- ToolExecution record created with:
  - `toolName: "delete_channel"`
  - `success: false`
  - `errorMessage: "Permission denied"`
  - `errorType: "permission"`
  - `duration` recorded
- Outcome record has error in `errors` array:
  ```javascript
  errors: [{
    tool: "delete_channel",
    error: "Permission denied"
  }]
  ```

**Verification Queries:**
```javascript
// Find failed tool execution
db.toolexecutions.findOne({
  toolName: "delete_channel",
  success: false,
  errorType: "permission"
}).sort({ timestamp: -1 })

// Find outcome with error
db.outcomes.findOne({
  userId: "<your_user_id>",
  "errors.tool": "delete_channel"
}).sort({ timestamp: -1 })
```

---

### Scenario 7: Tool Execution Success

**Objective:** Verify successful tool execution recorded.

**Steps:**
1. As **server owner**, send: `Sunny, create a channel called test-tracking`
2. Wait for success response
3. Verify channel created in Discord
4. Check logs for tool execution recording

**Expected Results:**
- Channel created successfully
- ToolExecution record with:
  - `toolName: "create_channel"`
  - `success: true`
  - `errorMessage: null`
  - `errorType: null`
  - `duration` recorded
- Outcome includes `toolsUsed: ["create_channel"]`

**Verification Query:**
```javascript
db.toolexecutions.findOne({
  toolName: "create_channel",
  success: true,
  guildId: "<your_guild_id>"
}).sort({ timestamp: -1 })
```

---

### Scenario 8: Multiple Tool Executions

**Objective:** Verify complex agentic loop with multiple tools tracked.

**Steps:**
1. Send: `Sunny, show me all channels, then create a new role called "Tester"`
2. Wait for response
3. Check logs for multiple tool executions

**Expected Results:**
- Multiple ToolExecution records created
- Outcome has:
  - `iterations >= 2`
  - `toolsUsed` contains both tools
  - `toolCount >= 2`
  - All tool executions link via `executionId`

**Verification Query:**
```javascript
const outcome = db.outcomes.findOne({
  userId: "<your_user_id>",
  toolCount: { $gte: 2 }
}).sort({ timestamp: -1 })

// Find all tool executions for this interaction
db.toolexecutions.find({
  executionId: outcome.executionId
})
```

---

### Scenario 9: Stats Retrieval (Future Phase 2)

**Objective:** Verify outcomeTracker.getStats() works correctly.

**Note:** This scenario is for manual testing via Node.js console or future admin tools.

**Steps:**
1. After running several test scenarios above, run in Node console:
```javascript
const outcomeTracker = require('./src/services/outcomeTracker');
const stats = await outcomeTracker.getStats(7); // Last 7 days
console.log(JSON.stringify(stats, null, 2));
```

**Expected Results:**
```json
{
  "period": 7,
  "total": 10,
  "successRate": 0.9,
  "avgIterations": 1.2,
  "avgDuration": 3500,
  "satisfaction": {
    "positive": 3,
    "negative": 1,
    "noReaction": 6
  },
  "modelUsage": {
    "glm-4.5-air": 7,
    "glm-4.6": 3
  }
}
```

---

### Scenario 10: Recent Outcomes Retrieval (Future Phase 2)

**Objective:** Verify outcomeTracker.getRecentOutcomes() filtering works.

**Steps:**
```javascript
const outcomeTracker = require('./src/services/outcomeTracker');

// Get all outcomes for a specific guild
const outcomes = await outcomeTracker.getRecentOutcomes({
  guildId: "<your_guild_id>"
}, 100);

console.log(`Found ${outcomes.length} outcomes`);
```

**Expected Results:**
- Returns array of outcome documents
- Sorted by timestamp (most recent first)
- Lean objects (POJOs) for performance

---

## Database Verification Queries

### Check Outcome Records Exist

```javascript
// MongoDB Shell
use sunnybot

// Count total outcomes
db.outcomes.countDocuments()

// View most recent outcome
db.outcomes.findOne({}, { sort: { timestamp: -1 } })

// Check outcomes for specific guild
db.outcomes.find({ guildId: "<guild_id>" }).sort({ timestamp: -1 }).limit(10)

// Check outcomes by complexity
db.outcomes.aggregate([
  { $group: { _id: "$predictedComplexity", count: { $sum: 1 } } }
])

// Check success rate
db.outcomes.aggregate([
  { $group: { 
      _id: null, 
      total: { $sum: 1 },
      successful: { $sum: { $cond: ["$success", 1, 0] } }
    }
  },
  { $project: {
      total: 1,
      successful: 1,
      successRate: { $divide: ["$successful", "$total"] }
    }
  }
])
```

---

### Check ToolExecution Records Exist

```javascript
// Count total tool executions
db.toolexecutions.countDocuments()

// View most recent tool execution
db.toolexecutions.findOne({}, { sort: { timestamp: -1 } })

// Check tool execution success rate
db.toolexecutions.aggregate([
  { $group: {
      _id: "$toolName",
      total: { $sum: 1 },
      successful: { $sum: { $cond: ["$success", 1, 0] } },
      failed: { $sum: { $cond: ["$success", 0, 1] } }
    }
  },
  { $sort: { total: -1 } }
])

// Check error type distribution
db.toolexecutions.aggregate([
  { $match: { success: false } },
  { $group: { _id: "$errorType", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Find slow tool executions (> 5 seconds)
db.toolexecutions.find({
  duration: { $gt: 5000 }
}).sort({ duration: -1 })
```

---

### Verify TTL Indexes Exist

```javascript
// Check Outcome indexes
db.outcomes.getIndexes()

// Should include:
// { "timestamp": 1 }, { expireAfterSeconds: 2592000 }

// Check ToolExecution indexes
db.toolexecutions.getIndexes()

// Should include:
// { "timestamp": 1 }, { expireAfterSeconds: 2592000 }
```

**Expected Indexes on Outcome:**
1. `{ _id: 1 }` (default)
2. `{ timestamp: 1 }` (regular index)
3. `{ userId: 1 }`
4. `{ guildId: 1 }`
5. `{ guildId: 1, timestamp: -1 }` (compound)
6. `{ modelUsed: 1, success: 1 }` (compound)
7. `{ success: 1, timestamp: -1 }` (compound)
8. `{ timestamp: 1 }` with TTL (expireAfterSeconds: 2592000)

**Expected Indexes on ToolExecution:**
1. `{ _id: 1 }` (default)
2. `{ timestamp: 1 }` (regular index)
3. `{ toolName: 1 }`
4. `{ success: 1 }`
5. `{ userId: 1 }`
6. `{ guildId: 1 }`
7. `{ executionId: 1 }`
8. `{ toolName: 1, timestamp: -1 }` (compound)
9. `{ toolName: 1, success: 1, timestamp: -1 }` (compound)
10. `{ guildId: 1, timestamp: -1 }` (compound)
11. `{ success: 1, errorType: 1, timestamp: -1 }` (compound)
12. `{ timestamp: 1 }` with TTL (expireAfterSeconds: 2592000)

---

### Verify Compound Indexes Work

```javascript
// Test guildId + timestamp compound index (Outcome)
db.outcomes.find({ guildId: "<guild_id>" })
  .sort({ timestamp: -1 })
  .explain("executionStats")
// Should show "indexName": "guildId_1_timestamp_-1"

// Test toolName + timestamp compound index (ToolExecution)
db.toolexecutions.find({ toolName: "list_channels" })
  .sort({ timestamp: -1 })
  .explain("executionStats")
// Should show "indexName": "toolName_1_timestamp_-1"

// Test failure analysis index
db.toolexecutions.find({ success: false, errorType: "permission" })
  .sort({ timestamp: -1 })
  .explain("executionStats")
// Should show compound index usage
```

---

## Edge Cases

### Edge Case 1: Metadata Cache Cleanup (5-min TTL)

**Scenario:** Message sent during metadata cache cleanup window.

**Steps:**
1. Send a message to Sunny
2. Wait 5 minutes (metadata TTL)
3. Check if metadata was cleaned up from cache
4. Verify outcome still recorded with available data

**Expected Behavior:**
- Metadata Map in `zaiProvider.js` auto-cleans after 5 minutes
- If metadata missing, outcome still records with `null` values for metadata fields
- No memory leak from stale metadata

**Test Implementation:**
```javascript
// In zaiProvider.js, the metadata is stored with TTL
// After 5 minutes, the cleanup function removes old entries
// This edge case verifies graceful degradation
```

**Verification:**
- Check Render logs for memory usage stability over time
- Verify no stale metadata after 5+ minutes
- Confirm outcomes still created even without metadata

---

### Edge Case 2: Very Long Agentic Loop (100+ Iterations)

**Scenario:** AI gets stuck in a long reasoning loop.

**Steps:**
1. Send an intentionally ambiguous/impossible task
2. Monitor iteration count in logs
3. Wait for max_iterations limit to be hit

**Expected Behavior:**
- Outcome records actual iteration count (even if very high)
- `toolsUsed` array contains all tools used
- `success: false` if max iterations exceeded
- `finishReason: "max_iterations"` or similar

**Safety Check:**
- Verify MongoDB can handle large arrays (toolsUsed)
- Ensure no performance degradation with high iteration counts
- Confirm graceful timeout

---

### Edge Case 3: Tool Execution Failure Mid-Loop

**Scenario:** Tool fails partway through agentic loop.

**Steps:**
1. As non-owner, send: `Sunny, list channels then delete one`
2. First tool succeeds (list_channels)
3. Second tool fails (permission denied)
4. Check recording

**Expected Behavior:**
- ToolExecution records created for BOTH tools:
  - `list_channels`: `success: true`
  - `delete_channel`: `success: false, errorType: "permission"`
- Outcome has:
  - `toolsUsed: ["list_channels", "delete_channel"]`
  - `errors` array includes delete_channel error
  - `success: false` (overall interaction failed)

**Verification:**
```javascript
db.toolexecutions.find({
  executionId: "<exec_id>"
}).sort({ timestamp: 1 })
// Should show both tool executions with different success values
```

---

### Edge Case 4: MongoDB Connection Failure (Graceful Degradation)

**Scenario:** MongoDB becomes unavailable during outcome recording.

**Steps:**
1. Temporarily disconnect MongoDB (simulate network issue)
2. Send message to Sunny
3. Verify bot still responds normally
4. Check logs for graceful error handling

**Expected Behavior:**
- Bot responds normally to user (no user-facing errors)
- Logs show: `[OutcomeTracker] Failed to record outcome: <error>`
- No uncaught exceptions
- No bot crash
- When MongoDB reconnects, new outcomes recorded normally

**Test Implementation:**
```bash
# In Render dashboard, temporarily pause MongoDB addon
# Or set invalid MONGODB_URI in .env for local test
```

**Success Criteria:**
- Fire-and-forget pattern prevents blocking
- User experience unaffected
- System self-heals when DB reconnects

---

### Edge Case 5: Reaction Collector Timeout Race Condition

**Scenario:** User reacts exactly at 60-second boundary.

**Steps:**
1. Send message to Sunny
2. Wait exactly 59 seconds
3. React with 👍 at ~60 seconds
4. Check if reaction captured

**Expected Behavior:**
- If reaction received before timeout: captured with `userSatisfaction: 1`
- If reaction received after timeout: missed, `userSatisfaction: 0`
- No duplicate outcome recordings
- No errors in logs

**Edge Case Handling:**
- Discord.js collector handles this automatically
- First outcome recording wins (no duplicates)
- Graceful handling either way

---

### Edge Case 6: Message Deleted Before Reactions Added

**Scenario:** User deletes their message immediately after sending.

**Steps:**
1. Send message to Sunny
2. Immediately delete the message
3. Check logs for reaction errors

**Expected Behavior:**
- Logs show: `[messageHandler] Failed to add satisfaction tracking: <error>`
- Outcome still recorded with `userReacted: false, userSatisfaction: 0`
- No crash or uncaught exceptions
- Fallback to fire-and-forget outcome recording without reactions

**Verification:**
```javascript
db.outcomes.findOne({
  userId: "<user_id>",
  userReacted: false
}).sort({ timestamp: -1 })
```

---

### Edge Case 7: Concurrent Messages from Same User

**Scenario:** User sends multiple messages rapidly.

**Steps:**
1. Send 5 messages to Sunny within 2 seconds
2. Wait for all responses
3. Check outcome recording

**Expected Behavior:**
- Each message gets unique `executionId`
- 5 separate Outcome records created
- No race conditions
- Each outcome tracked independently
- Reaction collectors don't interfere with each other

**Verification:**
```javascript
db.outcomes.find({
  userId: "<user_id>",
  timestamp: { $gte: new Date(Date.now() - 60000) }
}).count()
// Should equal 5
```

---

### Edge Case 8: Empty or Null Fields

**Scenario:** Outcome recorded with missing optional fields.

**Steps:**
1. Send very simple message (no tools, no attachments)
2. Don't react
3. Check outcome document

**Expected Behavior:**
- Required fields populated: `userId, guildId, query, success, iterations, timestamp`
- Optional fields gracefully null/default:
  - `modelReasoning: null`
  - `duration: null` (if not measured)
  - `errors: []`
  - `toolsUsed: []`
  - `userSatisfaction: 0`

**Verification:**
```javascript
db.outcomes.findOne({
  userId: "<user_id>",
  toolCount: 0,
  userReacted: false
}).sort({ timestamp: -1 })
```

---

## Performance Checks

### Check 1: Fire-and-Forget Doesn't Block Responses

**Objective:** Verify outcome recording is non-blocking.

**Test:**
1. Send message to Sunny
2. Measure response time
3. Compare with/without outcome tracking

**Measurement:**
```javascript
// Check messageHandler logs for timing
// Look for: "📨 Received finalResponse from agent (Xms)"
// Response time should be < 500ms overhead from tracking
```

**Success Criteria:**
- Total overhead from tracking: **< 100ms**
- User perceives no delay
- Fire-and-forget pattern confirmed

---

### Check 2: Metadata Map Cleanup Prevents Memory Leak

**Objective:** Verify metadata cache doesn't grow unbounded.

**Test:**
1. Monitor memory usage over 1 hour with frequent messages
2. Check metadata Map size periodically
3. Verify cleanup runs every 5 minutes

**Measurement:**
```javascript
// Add temporary logging to zaiProvider.js
console.log(`[zaiProvider] Metadata cache size: ${executionMetadata.size}`);
// Should never exceed ~100 entries (5min window at 20 msg/min = 100)
```

**Success Criteria:**
- Metadata Map size stays bounded
- Memory usage stable over time
- No memory leaks detected

---

### Check 3: DB Writes Don't Impact Message Latency

**Objective:** Verify MongoDB writes are truly non-blocking.

**Test:**
1. Send 10 messages rapidly
2. Measure response times
3. Compare with MongoDB slow query log

**Measurement:**
```bash
# Check Render logs for timing patterns
# Response time should be consistent regardless of DB load
```

**Success Criteria:**
- Message response time: **< 5 seconds average**
- No correlation between DB write time and response time
- Fire-and-forget confirmed in production

---

### Check 4: Index Performance

**Objective:** Verify compound indexes improve query performance.

**Test:**
```javascript
// Query with index
db.outcomes.find({ guildId: "<guild_id>" })
  .sort({ timestamp: -1 })
  .limit(100)
  .explain("executionStats")

// Check executionTimeMillis - should be < 50ms
```

**Success Criteria:**
- Index scan (not collection scan)
- Query time < 50ms for 1000 documents
- Compound indexes used correctly

---

### Check 5: TTL Index Background Task

**Objective:** Verify TTL cleanup doesn't impact performance.

**Test:**
1. Wait 30+ days (or manually set old timestamps for testing)
2. Verify old documents auto-deleted
3. Monitor DB performance during cleanup

**Accelerated Test:**
```javascript
// Create test documents with old timestamps
db.outcomes.insertOne({
  timestamp: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
  userId: "test",
  guildId: "test",
  query: "test",
  success: true,
  iterations: 0
})

// Wait ~60 seconds for TTL background task
// Document should be deleted automatically
```

**Success Criteria:**
- Old documents deleted within 60-120 seconds
- No performance degradation during cleanup
- TTL index working as expected

---

## Success Criteria

### Functional Requirements

- [ ] **100% of interactions create Outcome records**
  - Every message to Sunny creates exactly one Outcome
  - No missing outcomes
  - No duplicate outcomes

- [ ] **All tool executions create ToolExecution records**
  - Every tool call creates a record
  - Success/failure correctly tracked
  - Error types correctly classified

- [ ] **User reactions captured within 60s window**
  - 👍 reactions set `userSatisfaction: 1`
  - 👎 reactions set `userSatisfaction: -1`
  - No reaction sets `userSatisfaction: 0`
  - Collector ends after 60 seconds

- [ ] **No errors in Render logs**
  - Graceful error handling
  - No uncaught exceptions
  - No bot crashes

- [ ] **Response time overhead < 500ms**
  - Fire-and-forget doesn't block
  - User experience unaffected
  - Outcome tracking is transparent

### Data Quality Requirements

- [ ] **Complexity classification accurate**
  - GREETING for "hi", "hello"
  - SIMPLE for basic questions
  - MODERATE for tool-requiring tasks
  - COMPLEX for multi-step tasks
  - TECHNICAL for code/config requests

- [ ] **Model selection recorded correctly**
  - `modelUsed` field populated
  - `modelReasoning` captured when available
  - Matches actual model used

- [ ] **Execution metrics accurate**
  - `iterations` matches actual loop count
  - `toolsUsed` array complete
  - `duration` in milliseconds
  - `responseLength` matches actual response

- [ ] **Error tracking complete**
  - `errors` array populated on failures
  - ToolExecution records link via `executionId`
  - Error types classified correctly

### System Requirements

- [ ] **Graceful degradation on MongoDB failure**
  - Bot continues operating
  - User experience unaffected
  - Self-heals when DB reconnects

- [ ] **No memory leaks**
  - Metadata cache bounded
  - No unbounded growth
  - Stable over 24+ hours

- [ ] **Indexes created correctly**
  - All compound indexes exist
  - TTL indexes active
  - Query performance optimized

- [ ] **Data retention policy enforced**
  - Documents auto-delete after 30 days
  - TTL background task running
  - No manual cleanup needed

---

## Test Environment Setup

### Prerequisites

1. **MongoDB Database:**
   - Running instance (local or Render)
   - Accessible via `MONGODB_URI` env variable
   - Database name: `sunnybot` (or configured name)

2. **Discord Server:**
   - Test server with Sunny bot installed
   - You have owner permissions (for owner-only tool tests)
   - Additional non-owner account for permission tests

3. **Render Deployment:**
   - Bot deployed to Render
   - Access to Render logs
   - MongoDB addon connected

### Setup Steps

1. **Verify MongoDB Connection:**
```bash
# Check MONGODB_URI is set
echo $MONGODB_URI

# Connect to MongoDB shell
mongosh "$MONGODB_URI"
```

2. **Create Test Indexes (if not auto-created):**
```javascript
// Switch to database
use sunnybot

// Outcome indexes are created by Mongoose on first document insert
// Or manually create:
db.outcomes.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 })
db.toolexecutions.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 })
```

3. **Prepare Test Discord Server:**
- Create test channels
- Invite Sunny bot
- Ensure bot has necessary permissions

4. **Enable Verbose Logging (Optional):**
```bash
# In .env or Render environment
DEBUG=true
LOG_LEVEL=debug
```

---

## Troubleshooting Guide

### Issue: No Outcome Records Created

**Symptoms:**
- Messages processed but no outcomes in DB
- Logs don't show `[OutcomeTracker] Recorded outcome`

**Diagnosis:**
```javascript
// Check for errors in logs
grep -i "OutcomeTracker" render.log

// Check MongoDB connection
db.outcomes.stats()
```

**Solutions:**
1. Verify MongoDB connection (`MONGODB_URI` correct)
2. Check Mongoose model registration
3. Verify `outcomeTracker.recordOutcome()` called in messageHandler
4. Check for validation errors in logs

---

### Issue: ToolExecution Records Missing

**Symptoms:**
- Tools execute but no ToolExecution records
- Outcome shows tools but no linked executions

**Diagnosis:**
```javascript
// Check toolExecutor logs
grep -i "ToolExecutor" render.log

// Verify executionId linking
db.toolexecutions.find({ executionId: { $exists: false } })
```

**Solutions:**
1. Verify `recordToolExecution()` called in toolExecutor.js
2. Check `executionId` passed correctly from messageHandler
3. Verify ToolExecution model imported correctly
4. Check for MongoDB write errors

---

### Issue: Reactions Not Captured

**Symptoms:**
- User reacts but `userSatisfaction` stays 0
- No `User reaction captured` log

**Diagnosis:**
```javascript
// Check reaction collector logs
grep -i "reaction" render.log

// Check for permission errors
grep -i "Failed to add satisfaction tracking" render.log
```

**Solutions:**
1. Verify bot has `ADD_REACTIONS` permission
2. Check message wasn't deleted before reactions added
3. Verify collector filter logic correct
4. Ensure reaction within 60-second window

---

### Issue: Memory Leak Suspected

**Symptoms:**
- Memory usage grows over time
- Eventually crashes with OOM error

**Diagnosis:**
```bash
# Monitor memory in Render
# Check metadata Map size logs
grep -i "metadata" render.log
```

**Solutions:**
1. Verify metadata cleanup runs every 5 minutes
2. Check for event listener leaks (reaction collectors)
3. Ensure MongoDB connections properly pooled
4. Review for circular references

---

### Issue: Performance Degradation

**Symptoms:**
- Slow response times
- Database queries timing out

**Diagnosis:**
```javascript
// Check slow queries
db.setProfilingLevel(2)
db.system.profile.find().sort({ ts: -1 }).limit(10)

// Check index usage
db.outcomes.find({ guildId: "X" }).explain("executionStats")
```

**Solutions:**
1. Verify indexes created correctly
2. Check for missing compound indexes
3. Review query patterns
4. Consider adding more selective indexes

---

### Issue: TTL Index Not Deleting Old Data

**Symptoms:**
- Documents older than 30 days still exist
- Database growing indefinitely

**Diagnosis:**
```javascript
// Check TTL index exists
db.outcomes.getIndexes()

// Check for old documents
db.outcomes.find({
  timestamp: { $lt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) }
}).count()
```

**Solutions:**
1. Verify TTL index has `expireAfterSeconds` option
2. Wait 60 seconds (TTL task runs every minute)
3. Check MongoDB server time (must be correct)
4. Manually drop and recreate TTL index if stuck

---

## Next Steps After Phase 1 Testing

Once all tests pass and success criteria met:

1. **Deploy to Production:**
   - Merge Phase 1 implementation
   - Monitor production metrics for 1 week
   - Verify data collection working at scale

2. **Begin Phase 2 Planning:**
   - Pattern analysis algorithms
   - Model selection optimization
   - Admin tools for outcome visualization
   - Learning tools (`analyze_outcomes`, `get_learning_stats`)

3. **Data Analysis:**
   - Collect 1000+ outcomes for statistical significance
   - Analyze complexity prediction accuracy
   - Identify tool failure patterns
   - Correlate user satisfaction with model choices

---

## Appendix: Quick Reference

### Key Log Messages

```
✅ Message marked as processed
[OutcomeTracker] Recorded outcome: <id> (success: true, model: glm-4.6, iterations: 2)
📊 User reaction captured: 👍
📊 Reaction collector ended (limit, time), recording outcome...
[ToolExecutor] Recording tool execution: <tool_name>
[ToolExecutor] Failed to record execution: <error>
```

### Important File Paths

- Outcome Model: `src/models/Outcome.js`
- ToolExecution Model: `src/models/ToolExecution.js`
- OutcomeTracker Service: `src/services/outcomeTracker.js`
- Message Handler: `src/handlers/messageHandler.js`
- Tool Executor: `src/tools/toolExecutor.js`
- Z.AI Provider: `src/services/providers/zaiProvider.js`

### Environment Variables

```bash
MONGODB_URI=mongodb+srv://...
AI_PROVIDER=zai
DEBUG=true  # Optional for verbose logging
```

---

**Test Plan Version:** 1.0  
**Last Updated:** 2025-10-21  
**Status:** Ready for Execution
