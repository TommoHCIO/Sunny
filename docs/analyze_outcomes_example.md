# analyze_outcomes Tool - Example Output

## Tool Definition
```javascript
{
    name: 'analyze_outcomes',
    description: 'Analyze AI interaction outcomes for learning insights (owner only). Shows success rates, model usage, complexity accuracy, user satisfaction, and common error patterns.',
    input_schema: {
        type: 'object',
        properties: {
            days: {
                type: 'number',
                description: 'Number of days to analyze (default: 7, max: 30)'
            },
            filter_by: {
                type: 'string',
                enum: ['all', 'successful', 'failed', 'positive_feedback', 'negative_feedback'],
                description: 'Filter outcomes by type (default: all)'
            }
        },
        required: []
    }
}
```

## Example Usage

### Command 1: Default Analysis (7 days, all outcomes)
```
User: @SunnyBot analyze outcomes
```

**Response:**
```json
{
    "success": true,
    "analysis": {
        "period_days": 7,
        "filter": "all",
        "total_interactions": 234,
        "success_rate": "94.4%",
        "avg_iterations": "1.87",
        "avg_duration_ms": 2847,
        "model_usage": {
            "glm-4.5-air": 189,
            "glm-4.6": 45
        },
        "user_satisfaction": {
            "positive": 78,
            "negative": 12,
            "no_reaction": 144,
            "positive_rate": "33.3%"
        },
        "top_tools_used": [
            { "tool": "list_channels", "count": 89 },
            { "tool": "send_message", "count": 67 },
            { "tool": "list_roles", "count": 45 },
            { "tool": "create_channel", "count": 34 },
            { "tool": "get_member_info", "count": 28 },
            { "tool": "create_role", "count": 23 },
            { "tool": "generate_trivia_question", "count": 18 },
            { "tool": "pin_message", "count": 15 },
            { "tool": "set_role_permissions", "count": 12 },
            { "tool": "create_poll", "count": 9 }
        ],
        "total_tool_executions": 456,
        "common_errors": [
            {
                "tool": "create_channel",
                "count": 5,
                "sample_error": "Channel name already exists"
            },
            {
                "tool": "set_role_permissions",
                "count": 3,
                "sample_error": "Missing MANAGE_ROLES permission"
            },
            {
                "tool": "send_message",
                "count": 2,
                "sample_error": "Channel not found"
            }
        ]
    }
}
```

### Command 2: Failed Interactions Only (14 days)
```
User: @SunnyBot analyze outcomes for the last 14 days, show only failed interactions
```

**Response:**
```json
{
    "success": true,
    "analysis": {
        "period_days": 14,
        "filter": "failed",
        "total_interactions": 412,
        "success_rate": "95.1%",
        "avg_iterations": "2.34",
        "avg_duration_ms": 3214,
        "model_usage": {
            "glm-4.5-air": 312,
            "glm-4.6": 100
        },
        "user_satisfaction": {
            "positive": 134,
            "negative": 23,
            "no_reaction": 255,
            "positive_rate": "32.5%"
        },
        "top_tools_used": [
            { "tool": "create_channel", "count": 8 },
            { "tool": "delete_channel", "count": 5 },
            { "tool": "set_role_permissions", "count": 4 },
            { "tool": "ban_member", "count": 2 },
            { "tool": "send_message", "count": 1 }
        ],
        "total_tool_executions": 47,
        "common_errors": [
            {
                "tool": "create_channel",
                "count": 8,
                "sample_error": "Channel name already exists"
            },
            {
                "tool": "delete_channel",
                "count": 5,
                "sample_error": "Channel not found or already deleted"
            },
            {
                "tool": "set_role_permissions",
                "count": 4,
                "sample_error": "Missing MANAGE_ROLES permission"
            },
            {
                "tool": "ban_member",
                "count": 2,
                "sample_error": "Cannot ban server owner"
            }
        ]
    }
}
```

### Command 3: Positive Feedback Only (30 days max)
```
User: @SunnyBot analyze outcomes with positive feedback over last 30 days
```

**Response:**
```json
{
    "success": true,
    "analysis": {
        "period_days": 30,
        "filter": "positive_feedback",
        "total_interactions": 867,
        "success_rate": "96.8%",
        "avg_iterations": "1.76",
        "avg_duration_ms": 2456,
        "model_usage": {
            "glm-4.5-air": 698,
            "glm-4.6": 169
        },
        "user_satisfaction": {
            "positive": 289,
            "negative": 34,
            "no_reaction": 544,
            "positive_rate": "33.3%"
        },
        "top_tools_used": [
            { "tool": "generate_trivia_question", "count": 67 },
            { "tool": "create_poll", "count": 54 },
            { "tool": "start_trivia", "count": 43 },
            { "tool": "get_random_fact", "count": 38 },
            { "tool": "roll_dice", "count": 32 },
            { "tool": "magic_8ball", "count": 29 },
            { "tool": "flip_coin", "count": 26 }
        ],
        "total_tool_executions": 312,
        "common_errors": "No errors in this period"
    }
}
```

### Command 4: No Data Scenario
```
User: @SunnyBot analyze outcomes
```

**Response (when no data exists):**
```json
{
    "success": true,
    "analysis": {
        "period_days": 7,
        "filter": "all",
        "message": "No interaction data found for the last 7 days.",
        "total_interactions": 0
    }
}
```

## Key Insights from Analysis

The analyze_outcomes tool provides valuable insights for:

1. **Success Rate Monitoring**: Track how often AI interactions complete successfully
2. **Model Performance**: Compare glm-4.5-air vs glm-4.6 usage patterns
3. **User Engagement**: Monitor positive/negative feedback rates
4. **Tool Usage Patterns**: Identify most frequently used tools
5. **Error Detection**: Spot common failure points requiring fixes
6. **Performance Metrics**: Track average iterations and response times

## Use Cases

- **Weekly Reviews**: `analyze_outcomes` (default 7 days)
- **Failure Analysis**: `analyze_outcomes for 14 days, failed only`
- **User Satisfaction**: `analyze_outcomes showing positive feedback`
- **Monthly Reports**: `analyze_outcomes for 30 days`
- **Error Investigation**: Filter by failed + review common_errors

## Integration Notes

- **Owner-only**: Restricted to bot owner for privacy/security
- **Guild-scoped**: Only shows data for the current Discord server
- **TTL**: Data automatically expires after 30 days (MongoDB TTL index)
- **Performance**: Uses MongoDB aggregation for efficient statistics
- **Non-blocking**: Fire-and-forget outcome recording doesn't impact bot performance
