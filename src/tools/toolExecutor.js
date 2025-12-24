// src/tools/toolExecutor.js
/**
 * Tool Executor - Maps Claude tool calls to Discord operations
 * Handles permission checks and executes Discord.js operations
 * Reuses existing ActionHandler logic where possible
 */

const { ChannelType } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const { retryWithBackoff } = require('../utils/retry');
const { toolExecutionRateLimiter } = require('../utils/rateLimiter');
const ActionHandler = require('../handlers/actionHandler');
const serverInspection = require('./serverInspection');
const memberManagement = require('./memberManagement');
const advancedModeration = require('./advancedModeration');
const roleManagement = require('./roleManagement');
const channelMemberTools = require('./channelMemberTools');
const autoMessageService = require('../services/autoMessageService');
const ticketService = require('../services/ticketService');
const gameService = require('../services/gameService');
const outcomeTracker = require('../services/outcomeTracker');
const ServerSettings = require('../models/ServerSettings');
const ToolExecution = require('../models/ToolExecution');
const crypto = require('crypto');

// Initialize action handler (singleton pattern)
let actionHandler = null;

/**
 * Record tool execution for AGI learning system
 * Fire-and-forget pattern - never blocks tool execution
 * @param {Object} executionData - Tool execution data
 */
async function recordToolExecution(executionData) {
    try {
        await ToolExecution.create(executionData);
    } catch (error) {
        // Graceful degradation - logging failure doesn't break tool execution
        console.error('[ToolExecutor] Failed to record execution:', error.message);
    }
}

/**
 * Classify error type for pattern analysis
 * @param {string} errorMessage - Error message from tool execution
 * @returns {string|null} Error type category
 */
function classifyErrorType(errorMessage) {
    if (!errorMessage) return null;
    
    const msg = errorMessage.toLowerCase();
    if (msg.includes('permission') || msg.includes('missing access')) return 'permission';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'rate_limit';
    if (msg.includes('invalid') || msg.includes('required')) return 'invalid_args';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
    if (msg.includes('api') || msg.includes('discord')) return 'api_error';
    return 'unknown';
}

/**
 * Hash tool arguments for pattern detection without storing sensitive data
 * @param {Object} args - Tool arguments
 * @returns {string} SHA256 hash of stringified args
 */
function hashArguments(args) {
    try {
        const argsString = JSON.stringify(args);
        return crypto.createHash('sha256').update(argsString).digest('hex').substring(0, 16);
    } catch (error) {
        return null;
    }
}

/**
 * Execute a Discord tool based on Claude's request
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} input - Tool input parameters
 * @param {Object} guild - Discord guild object
 * @param {Object} author - Discord user object (for permission checks)
 * @param {string} executionId - Optional execution ID for linking to Outcome tracking
 * @returns {Promise<Object>} Tool execution result
 */
async function execute(toolName, input, guild, author, executionId = null) {
    const startTime = Date.now();

    // Normalize parameter names (AI models may use different names)
    // This handles cases where Llama sends 'channel' instead of 'channelName', etc.
    if (input) {
        if (input.channel && !input.channelName) {
            input.channelName = input.channel;
            delete input.channel;
        }
        if (input.role && !input.roleName) {
            input.roleName = input.role;
            delete input.role;
        }
        if (input.user && !input.userId && !input.username) {
            input.username = input.user;
            delete input.user;
        }
        if (input.member && !input.memberId && !input.memberName) {
            input.memberName = input.member;
            delete input.member;
        }
    }

    // Initialize action handler if needed
    if (!actionHandler) {
        // Create a minimal client object for ActionHandler
        const mockClient = {
            guilds: {
                cache: new Map([[guild.id, guild]])
            }
        };
        actionHandler = new ActionHandler(mockClient);
    }

    // Define owner-only tools
    const ownerOnlyTools = [
        'delete_channel', 'create_channel', 'rename_channel', 'create_category',
        'delete_category', 'move_channel', 'set_channel_topic', 'set_slowmode',
        'set_channel_nsfw', 'set_channel_position', 'create_role', 'delete_role', 'rename_role',
        'set_role_color', 'kick_member', 'ban_member', 'unban_member',
        'remove_timeout', 'set_nickname', 'archive_thread', 'lock_thread',
        'delete_event', 'create_emoji', 'delete_emoji', 'edit_emoji',
        // New owner-only tools
        'pin_message', 'unpin_message', 'purge_messages', 'remove_all_reactions',
        'set_server_name', 'set_server_icon', 'set_server_banner', 'set_verification_level',
        'delete_invite', 'create_webhook', 'delete_webhook', 'edit_webhook', 'execute_webhook',
        'delete_thread', 'pin_thread', 'create_sticker', 'edit_sticker', 'delete_sticker',
        'edit_event', 'start_event', 'end_event',
        'create_stage_channel', 'set_bitrate', 'set_user_limit', 'set_rtc_region', 'create_stage_instance',
        'set_channel_permissions', 'remove_channel_permission', 'sync_channel_permissions',
        'create_forum_channel', 'set_default_thread_slowmode', 'set_available_tags',
        'set_role_permissions', 'add_role_permission', 'remove_role_permission', 'hoist_role', 'mentionable_role',
        'set_role_position', 'create_automod_rule', 'delete_automod_rule', 'edit_automod_rule',
        'set_member_deaf', 'set_member_mute',
        'get_audit_logs', 'get_bans',
        // Auto message and ticketing tools
        'create_auto_message', 'update_auto_message', 'delete_auto_message', 'enable_auto_messages', 'disable_auto_messages',
        'create_ticket', 'close_ticket', 'assign_ticket', 'update_ticket_priority', 'add_ticket_tag',
        'enable_ticketing', 'disable_ticketing', 'configure_ticket_categories',
        // AGI learning system tools
        'analyze_outcomes', 'get_learning_stats'
    ];

    // Permission check for owner-only tools
    if (ownerOnlyTools.includes(toolName) && !isOwner(author.id)) {
        console.log(`❌ Permission denied: ${author.username} tried to use ${toolName}`);
        
        const errorMsg = `Only the server owner can use ${toolName}. This action requires elevated permissions to keep the server safe! 🍂`;
        const duration = Date.now() - startTime;
        
        // Record permission denied execution (fire-and-forget)
        recordToolExecution({
            timestamp: new Date(),
            toolName,
            success: false,
            errorMessage: 'Permission denied',
            errorType: 'permission',
            duration,
            userId: author.id,
            guildId: guild.id,
            executionId,
            argsHash: hashArguments(input)
        }).catch(() => {}); // Graceful degradation
        
        return {
            success: false,
            error: errorMsg,
            permission_denied: true
        };
    }

    try {
        // Apply rate limiting before executing any tool
        // This prevents hammering Discord API with rapid tool calls
        await toolExecutionRateLimiter.removeTokens(1);

        // Route tool to appropriate handler
        switch (toolName) {
            // ===== SERVER INSPECTION TOOLS =====
            case 'list_channels': {
                const result = await listChannels(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'list_roles':
                return await listRoles(guild, input);

            case 'list_members':
                return await listMembers(guild, input);

            case 'get_channel_info':
                return await getChannelInfo(guild, input);

            // ===== CHANNEL MANAGEMENT =====
            case 'create_channel': {
                const result = await actionHandler.createChannel(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'delete_channel':
                return await actionHandler.deleteChannel(guild, input);

            case 'rename_channel':
                return await actionHandler.renameChannel(guild, input);

            case 'create_category':
                return await actionHandler.createCategory(guild, input);

            case 'delete_category':
                return await actionHandler.deleteCategory(guild, input);

            case 'move_channel':
                return await actionHandler.moveChannel(guild, input);

            case 'set_channel_topic':
                return await actionHandler.setChannelTopic(guild, input);

            case 'set_slowmode':
                return await actionHandler.setChannelSlowmode(guild, { channelName: input.channelName, seconds: input.seconds });

            case 'set_channel_nsfw':
                return await actionHandler.setChannelNSFW(guild, input);

            // ===== ROLE MANAGEMENT =====
            case 'create_role':
                return await actionHandler.createRole(guild, input);

            case 'delete_role':
                return await actionHandler.deleteRole(guild, input);

            case 'rename_role':
                return await actionHandler.renameRole(guild, input);

            case 'set_role_color':
                return await actionHandler.setRoleColor(guild, input);

            case 'assign_role': {
                const result = await assignRole(guild, author, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'remove_role':
                return await removeRole(guild, author, input);

            // ===== MEMBER MANAGEMENT =====
            case 'timeout_member':
                return await actionHandler.timeoutMember(guild, input);

            case 'remove_timeout':
                return await actionHandler.removeTimeout(guild, input);

            case 'kick_member': {
                const result = await actionHandler.kickMember(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'ban_member':
                return await actionHandler.banMember(guild, input);

            case 'unban_member':
                return await actionHandler.unbanMember(guild, input);

            case 'set_nickname':
                return await actionHandler.setNickname(guild, input);

            // ===== THREAD MANAGEMENT =====
            case 'create_thread':
                return await createThreadInChannel(guild, input);

            case 'archive_thread':
                return await actionHandler.archiveThread(guild, input);

            case 'lock_thread':
                return await actionHandler.lockThread(guild, input);

            case 'create_forum_post':
                return await actionHandler.createForumPost(guild, input);

            // ===== EVENT MANAGEMENT =====
            case 'create_event':
                return await actionHandler.createScheduledEvent(guild, input);

            case 'delete_event':
                return await deleteScheduledEvent(guild, input);

            // ===== EMOJI MANAGEMENT =====
            case 'list_emojis':
                return await listEmojis(guild, input);

            case 'create_emoji':
                return await actionHandler.createEmoji(guild, input);

            case 'delete_emoji':
                return await deleteEmoji(guild, input);

            case 'list_stickers':
                return await listStickers(guild, input);

            case 'edit_emoji':
                return await actionHandler.editEmoji(guild, input);

            // ===== MESSAGE MANAGEMENT =====
            case 'send_message': {
                const result = await sendMessage(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'send_embed':
                return await sendEmbed(guild, input);

            case 'edit_message':
                return await editMessage(guild, input);

            case 'delete_message':
                return await deleteMessage(guild, input);

            case 'pin_message':
                return await pinMessage(guild, input);

            case 'unpin_message':
                return await unpinMessage(guild, input);

            case 'purge_messages':
                return await purgeMessages(guild, input);

            case 'get_channel_messages':
                return await getChannelMessages(guild, input);

            // ===== REACTION MANAGEMENT =====
            case 'add_reaction':
                return await addReaction(guild, input);

            case 'remove_reaction':
                return await removeReaction(guild, input);

            case 'remove_all_reactions':
                return await removeAllReactions(guild, input);

            case 'setup_reaction_role':
                return await setupReactionRole(guild, input);

            case 'remove_reaction_role':
                return await removeReactionRole(guild, input);

            case 'list_reaction_roles':
                return await listReactionRoles(guild, input);

            case 'send_button_message':
                return await sendButtonMessage(guild, input);

            // ===== SERVER SETTINGS =====
            case 'set_server_name':
                return await actionHandler.setServerName(guild, input);

            case 'set_server_icon':
                return await actionHandler.setServerIcon(guild, input);

            case 'set_server_banner':
                return await actionHandler.setServerBanner(guild, input);

            case 'set_verification_level':
                return await actionHandler.setVerificationLevel(guild, input);

            // ===== INVITE MANAGEMENT =====
            case 'create_invite':
                return await createInvite(guild, input);

            case 'delete_invite':
                return await actionHandler.deleteInvite(guild, input);

            case 'list_invites':
                return await listInvites(guild, input);

            // ===== WEBHOOK MANAGEMENT =====
            case 'create_webhook':
                return await actionHandler.createWebhook(guild, input);

            case 'list_webhooks':
                return await listWebhooks(guild, input);

            case 'delete_webhook':
                return await actionHandler.deleteWebhook(guild, input);

            // ===== EXTENDED THREAD TOOLS =====
            case 'delete_thread':
                return await actionHandler.deleteThread(guild, input);

            case 'pin_thread':
                return await actionHandler.pinThread(guild, input);

            // ===== STICKER MANAGEMENT =====
            case 'create_sticker':
                return await actionHandler.createSticker(guild, input);

            case 'edit_sticker':
                return await actionHandler.editSticker(guild, input);

            case 'delete_sticker':
                return await actionHandler.deleteSticker(guild, input);

            // ===== EXTENDED EVENT TOOLS =====
            case 'edit_event':
                return await actionHandler.editScheduledEvent(guild, input);

            case 'start_event':
                return await actionHandler.startScheduledEvent(guild, input);

            case 'end_event':
                return await actionHandler.endScheduledEvent(guild, input);

            // ===== VOICE/STAGE CHANNEL TOOLS =====
            case 'create_stage_channel':
                return await actionHandler.createStageChannel(guild, input);

            case 'set_bitrate':
                return await actionHandler.setBitrate(guild, input);

            case 'set_user_limit':
                return await actionHandler.setUserLimit(guild, input);

            case 'set_rtc_region':
                return await actionHandler.setRTCRegion(guild, input);

            case 'create_stage_instance':
                return await actionHandler.createStageInstance(guild, input);

            // ===== CHANNEL PERMISSIONS TOOLS =====
            case 'set_channel_permissions':
                return await actionHandler.setChannelPermissions(guild, input);

            case 'remove_channel_permission':
                return await actionHandler.removeChannelPermission(guild, input);

            case 'sync_channel_permissions':
                return await actionHandler.syncChannelPermissions(guild, input);

            // ===== FORUM CHANNEL TOOLS =====
            case 'create_forum_channel':
                return await actionHandler.createForumChannel(guild, input);

            case 'set_default_thread_slowmode':
                return await actionHandler.setDefaultThreadSlowmode(guild, input);

            case 'set_available_tags':
                return await actionHandler.setAvailableTags(guild, input);

            // ===== ROLE PERMISSIONS TOOLS =====
            case 'set_role_permissions':
                return await actionHandler.setRolePermissions(guild, input);

            // ===== AUTOMODERATION TOOLS =====
            case 'create_automod_rule':
                return await createAutoModRule(guild, input);

            case 'list_automod_rules':
                return await listAutoModRules(guild, input);

            case 'delete_automod_rule':
                return await deleteAutoModRule(guild, input);

            // ===== MODERATION LOGS TOOLS =====
            case 'get_audit_logs':
                return await getAuditLogs(guild, input);

            case 'get_bans':
                return await getBans(guild, input);

            // ===== SERVER INSPECTION TOOLS (#94-98) =====
            case 'get_server_info': {
                const result = await serverInspection.getServerInfo(guild);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'get_server_settings':
                return await serverInspection.getServerSettings(guild);

            case 'get_current_permissions':
                return await serverInspection.getCurrentPermissions(guild);

            case 'list_server_features':
                return await serverInspection.listServerFeatures(guild);

            case 'get_moderation_stats':
                return await serverInspection.getModerationStats(guild);

            case 'audit_permissions':
                return await auditPermissions(guild, input);

            // ===== MEMBER MANAGEMENT TOOLS (#99-103) =====
            case 'get_member_info': {
                const result = await memberManagement.getMemberInfo(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'get_member_roles':
                return await memberManagement.getMemberRoles(guild, input);

            case 'get_member_permissions':
                return await memberManagement.getMemberPermissions(guild, input);

            case 'list_members_with_role':
                return await memberManagement.listMembersWithRole(guild, input);

            case 'search_members':
                return await memberManagement.searchMembers(guild, input);

            // ===== ADVANCED MODERATION TOOLS (#104-108) =====
            case 'list_timeouts':
                return await advancedModeration.listTimeouts(guild);

            case 'remove_timeout':
                return await advancedModeration.removeTimeout(guild, input);

            case 'get_audit_log':
                return await advancedModeration.getAuditLog(guild, input);

            case 'ban_member':
                return await advancedModeration.banMember(guild, input);

            case 'unban_member':
                return await advancedModeration.unbanMember(guild, input);

            // ===== ROLE MANAGEMENT TOOLS (#109-112+) =====
            case 'get_role_info':
                return await roleManagement.getRoleInfo(guild, input.roleId);

            case 'get_role_members':
                return await roleManagement.getRoleMembers(guild, input.roleId);

            case 'update_role_permissions':
                return await roleManagement.updateRolePermissions(guild, input.roleId, input.permissions, input.reason);

            case 'reorder_roles':
                return await roleManagement.reorderRoles(guild, input.roleId, input.newPosition, input.reason);

            case 'add_role_permission':
                return await roleManagement.addRolePermission(guild, input.roleId, input.permissions, input.reason);

            case 'remove_role_permission':
                return await roleManagement.removeRolePermission(guild, input.roleId, input.permissions, input.reason);

            case 'hoist_role':
                return await roleManagement.hoistRole(guild, input.roleId, input.hoisted, input.reason);

            case 'mentionable_role':
                return await roleManagement.mentionableRole(guild, input.roleId, input.mentionable, input.reason);

            case 'set_role_position':
                return await roleManagement.setRolePosition(guild, input.roleId, input.position, input.reason);

            // ===== CHANNEL & MEMBER EXTENDED TOOLS =====
            case 'set_channel_position':
                return await channelMemberTools.setChannelPosition(guild, input.channelName, input.position, input.reason);

            case 'get_channel_permissions':
                return await channelMemberTools.getChannelPermissions(guild, input.channelName);

            case 'set_member_deaf':
                return await channelMemberTools.setMemberDeaf(guild, input.userId, input.deaf, input.reason);

            case 'set_member_mute':
                return await channelMemberTools.setMemberMute(guild, input.userId, input.mute, input.reason);

            case 'execute_webhook':
                return await channelMemberTools.executeWebhook(guild, input.webhookId, input.content, {
                    username: input.username,
                    avatarURL: input.avatarURL
                });

            case 'edit_webhook':
                return await channelMemberTools.editWebhook(guild, input.webhookId, {
                    name: input.name,
                    avatar: input.avatar,
                    channelId: input.channelId
                }, input.reason);

            case 'edit_automod_rule':
                return await channelMemberTools.editAutoModRule(guild, input.ruleName, {
                    newName: input.newName,
                    enabled: input.enabled,
                    keywords: input.keywords,
                    mentionLimit: input.mentionLimit,
                    action: input.action,
                    alertChannelName: input.alertChannelName
                });

            // ===== AUTOMATIC MESSAGE TOOLS =====
            case 'create_auto_message': {
                const result = await createAutoMessage(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'list_auto_messages':
                return await listAutoMessages(guild, input);

            case 'update_auto_message':
                return await updateAutoMessage(guild, input);

            case 'delete_auto_message':
                return await deleteAutoMessage(guild, input);

            case 'get_auto_message':
                return await getAutoMessage(guild, input);

            case 'enable_auto_messages':
                return await enableAutoMessages(guild, input);

            case 'disable_auto_messages':
                return await disableAutoMessages(guild, input);

            // ===== TICKETING SYSTEM TOOLS =====
            case 'create_ticket': {
                const result = await createTicket(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'close_ticket':
                return await closeTicket(guild, input);

            case 'assign_ticket':
                return await assignTicket(guild, input);

            case 'update_ticket_priority':
                return await updateTicketPriority(guild, input);

            case 'list_tickets':
                return await listTickets(guild, input);

            case 'get_ticket_stats':
                return await getTicketStats(guild, input);

            case 'get_ticket':
                return await getTicket(guild, input);

            case 'add_ticket_tag':
                return await addTicketTag(guild, input);

            case 'enable_ticketing':
                return await enableTicketing(guild, input);

            case 'disable_ticketing':
                return await disableTicketing(guild, input);

            case 'configure_ticket_categories':
                return await configureTicketCategories(guild, input);

            // ===== GAME AND ENTERTAINMENT TOOLS =====
            case 'generate_trivia_question': {
                const result = await generateSingleTriviaQuestion(guild, input);
                const duration = Date.now() - startTime;
                recordToolExecution({
                    timestamp: new Date(),
                    toolName,
                    success: result?.success !== false,
                    errorMessage: result?.error || null,
                    errorType: result?.error ? classifyErrorType(result.error) : null,
                    duration,
                    userId: author.id,
                    guildId: guild.id,
                    executionId,
                    argsHash: hashArguments(input)
                }).catch(() => {});
                return result;
            }

            case 'start_trivia':
                return await startTrivia(guild, input);

            case 'get_trivia_leaderboard':
                return await getTriviaLeaderboard(guild, input);

            case 'create_poll':
                return await createPoll(guild, input);

            case 'create_quick_poll':
                return await createQuickPoll(guild, input);

            case 'start_rps':
                return await startRockPaperScissors(guild, input, author);

            case 'start_number_guess':
                return await startNumberGuess(guild, input, author);

            case 'roll_dice':
                return await rollDice(guild, input);

            case 'flip_coin':
                return await flipCoin(guild, input);

            case 'magic_8ball':
                return await magic8Ball(guild, input);

            case 'get_random_fact':
                return await getRandomFact(guild, input);

            case 'get_game_leaderboard':
                return await getGameLeaderboard(guild, input);

            case 'get_user_game_stats':
                return await getUserGameStats(guild, input);

            // ===== AGI LEARNING SYSTEM TOOLS =====
            case 'analyze_outcomes':
                return await analyzeOutcomes(guild, input);

            case 'get_learning_stats':
                return await getLearningStats(guild, input);

            case 'review_patterns':
                return await reviewPatterns(guild, input, message);

            case 'run_pattern_analysis':
                return await runPatternAnalysis(guild, input);

            case 'propose_adjustments':
                return await proposeAdjustments(guild, input);

            case 'approve_adjustment':
                return await approveAdjustment(guild, input, message);

            case 'reject_adjustment':
                return await rejectAdjustment(guild, input);

            case 'monitor_adjustments':
                return await monitorAdjustments(guild, input);

            case 'rollback_adjustment':
                return await rollbackAdjustment(guild, input);

            case 'adjustment_history':
                return await adjustmentHistory(guild, input);

            default:
                console.error(`❌ Unknown tool: ${toolName}`);
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}. This shouldn't happen - let the developer know!`
                };
        }
    } catch (error) {
        console.error(`❌ Error executing tool ${toolName}:`, error);
        
        const duration = Date.now() - startTime;
        const errorMsg = error.message;
        
        // Record failed execution (fire-and-forget)
        recordToolExecution({
            timestamp: new Date(),
            toolName,
            success: false,
            errorMessage: errorMsg,
            errorType: classifyErrorType(errorMsg),
            duration,
            userId: author.id,
            guildId: guild.id,
            executionId,
            argsHash: hashArguments(input)
        }).catch(() => {}); // Graceful degradation
        
        return {
            success: false,
            error: error.message,
            tool: toolName
        };
    }
}

// ===== SERVER INSPECTION IMPLEMENTATIONS =====

async function listChannels(guild, input) {
    try {
        const filterType = input.filter_type || 'all';
        const includeIds = input.include_ids || false;

        let channels = Array.from(guild.channels.cache.values());

        // Filter by type
        if (filterType !== 'all') {
            const typeMap = {
                'text': ChannelType.GuildText,
                'voice': ChannelType.GuildVoice,
                'category': ChannelType.GuildCategory,
                'forum': ChannelType.GuildForum,
                'stage': ChannelType.GuildStageVoice,
                'thread': ChannelType.PublicThread
            };

            const targetType = typeMap[filterType];
            if (targetType) {
                channels = channels.filter(c => c.type === targetType);
            }
        }

        // Map to readable format
        const channelList = channels.map(c => {
            const info = {
                name: c.name,
                type: getChannelTypeName(c.type),
                category: c.parent?.name || 'No category'
            };

            if (c.topic) info.topic = c.topic;
            if (includeIds) info.id = c.id;

            return info;
        });

        return {
            success: true,
            channels: channelList,
            total: channelList.length,
            filter_applied: filterType
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list channels: ${error.message}`
        };
    }
}

async function listRoles(guild, input) {
    try {
        const includePermissions = input.include_permissions || false;
        const includeIds = input.include_ids || false;

        const roles = Array.from(guild.roles.cache.values())
            .filter(r => r.name !== '@everyone')  // Exclude @everyone
            .map(r => {
                const info = {
                    name: r.name,
                    color: r.hexColor,
                    position: r.position,
                    member_count: r.members.size,
                    hoisted: r.hoist,
                    mentionable: r.mentionable
                };

                if (includeIds) {
                    info.id = r.id;
                }

                if (includePermissions) {
                    info.permissions = r.permissions.toArray();
                }

                return info;
            })
            .sort((a, b) => b.position - a.position);  // Sort by position (highest first)

        return {
            success: true,
            roles: roles,
            total: roles.length
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list roles: ${error.message}`
        };
    }
}

async function listMembers(guild, input) {
    try {
        const onlineOnly = input.online_only || false;
        const roleFilter = input.role_filter || null;
        const limit = input.limit || 50;

        // Fetch all members (required for accurate list) with retry logic
        await retryWithBackoff(
            () => guild.members.fetch(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Guild Members'
            }
        );

        let members = Array.from(guild.members.cache.values());

        // Filter by online status
        if (onlineOnly) {
            members = members.filter(m => m.presence?.status && m.presence.status !== 'offline');
        }

        // Filter by role
        if (roleFilter) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleFilter.toLowerCase());
            if (role) {
                members = members.filter(m => m.roles.cache.has(role.id));
            }
        }

        // Limit results
        members = members.slice(0, limit);

        // Map to readable format
        const memberList = members.map(m => ({
            username: m.user.username,
            nickname: m.nickname || 'None',
            id: m.id,
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name),
            joined_at: m.joinedAt?.toLocaleDateString() || 'Unknown',
            status: m.presence?.status || 'offline'
        }));

        return {
            success: true,
            members: memberList,
            total: memberList.length,
            showing_limit: limit,
            total_in_server: guild.memberCount
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list members: ${error.message}`
        };
    }
}

async function getChannelInfo(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channel_name.toLowerCase());

        if (!channel) {
            return {
                success: false,
                error: `Channel "${input.channel_name}" not found`
            };
        }

        const info = {
            name: channel.name,
            id: channel.id,
            type: getChannelTypeName(channel.type),
            category: channel.parent?.name || 'No category',
            topic: channel.topic || 'No topic',
            nsfw: channel.nsfw || false,
            position: channel.position
        };

        if (channel.rateLimitPerUser) {
            info.slowmode = `${channel.rateLimitPerUser} seconds`;
        }

        return {
            success: true,
            channel: info
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get channel info: ${error.message}`
        };
    }
}

async function auditPermissions(guild, input) {
    try {
        const { PermissionFlagsBits } = require('discord.js');
        const showIssuesOnly = input.show_issues_only || false;
        const checkRole = input.check_role;

        const channels = Array.from(guild.channels.cache.values())
            .filter(c => c.type !== ChannelType.GuildCategory); // Process categories separately
        const categories = Array.from(guild.channels.cache.values())
            .filter(c => c.type === ChannelType.GuildCategory);

        const everyoneRole = guild.roles.everyone;
        const allRoles = Array.from(guild.roles.cache.values());

        const audit = [];
        const issues = [];

        // Audit categories first
        for (const category of categories) {
            const categoryPerms = {
                name: category.name,
                type: 'Category',
                id: category.id,
                permissions: {},
                issues: []
            };

            // Check @everyone permissions
            const everyoneOverwrites = category.permissionOverwrites.cache.get(everyoneRole.id);
            if (everyoneOverwrites) {
                const perms = everyoneOverwrites.allow;
                categoryPerms.permissions['@everyone'] = {
                    view: perms.has(PermissionFlagsBits.ViewChannel),
                    send: perms.has(PermissionFlagsBits.SendMessages),
                    denied: everyoneOverwrites.deny.toArray().length > 0
                };

                // Check for overly permissive @everyone
                if (perms.has(PermissionFlagsBits.ViewChannel)) {
                    categoryPerms.issues.push('@everyone can view this category - may expose private channels');
                }
            } else {
                categoryPerms.permissions['@everyone'] = { view: true, send: true, denied: false };
                categoryPerms.issues.push('@everyone has DEFAULT permissions - category is fully public');
            }

            // Check role-specific permissions
            for (const role of allRoles) {
                if (role.name === '@everyone') continue;
                if (checkRole && role.name.toLowerCase() !== checkRole.toLowerCase()) continue;

                const roleOverwrites = category.permissionOverwrites.cache.get(role.id);
                if (roleOverwrites) {
                    categoryPerms.permissions[role.name] = {
                        view: roleOverwrites.allow.has(PermissionFlagsBits.ViewChannel),
                        send: roleOverwrites.allow.has(PermissionFlagsBits.SendMessages),
                        manage: roleOverwrites.allow.has(PermissionFlagsBits.ManageChannels),
                        denied: roleOverwrites.deny.has(PermissionFlagsBits.ViewChannel)
                    };
                }
            }

            if (!showIssuesOnly || categoryPerms.issues.length > 0) {
                audit.push(categoryPerms);
                if (categoryPerms.issues.length > 0) issues.push(`Category "${category.name}": ${categoryPerms.issues.join(', ')}`);
            }
        }

        // Audit channels
        for (const channel of channels) {
            const channelPerms = {
                name: channel.name,
                type: getChannelTypeName(channel.type),
                category: channel.parent?.name || 'No category',
                id: channel.id,
                permissions: {},
                issues: []
            };

            // Check @everyone permissions
            const everyoneOverwrites = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (everyoneOverwrites) {
                const perms = everyoneOverwrites.allow;
                const denies = everyoneOverwrites.deny;

                channelPerms.permissions['@everyone'] = {
                    view: !denies.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.ViewChannel),
                    send: !denies.has(PermissionFlagsBits.SendMessages) && perms.has(PermissionFlagsBits.SendMessages),
                    denied: denies.has(PermissionFlagsBits.ViewChannel)
                };

                // Check for overly permissive @everyone
                if (!denies.has(PermissionFlagsBits.ViewChannel) && channel.parent) {
                    const parentPerms = channel.parent.permissionOverwrites.cache.get(everyoneRole.id);
                    if (!parentPerms || !parentPerms.deny.has(PermissionFlagsBits.ViewChannel)) {
                        channelPerms.issues.push('@everyone can view - should this be role-restricted?');
                    }
                }
            } else {
                // No explicit overwrites - inherits from category or server
                if (!channel.parent) {
                    channelPerms.permissions['@everyone'] = { view: true, send: true, denied: false };
                    channelPerms.issues.push('@everyone has DEFAULT permissions - channel is fully public');
                } else {
                    channelPerms.permissions['@everyone'] = { inherits: true, from: channel.parent.name };
                }
            }

            // Check role-specific permissions
            for (const role of allRoles) {
                if (role.name === '@everyone') continue;
                if (checkRole && role.name.toLowerCase() !== checkRole.toLowerCase()) continue;

                const roleOverwrites = channel.permissionOverwrites.cache.get(role.id);
                if (roleOverwrites) {
                    const allows = roleOverwrites.allow;
                    const denies = roleOverwrites.deny;

                    channelPerms.permissions[role.name] = {
                        view: allows.has(PermissionFlagsBits.ViewChannel) && !denies.has(PermissionFlagsBits.ViewChannel),
                        send: allows.has(PermissionFlagsBits.SendMessages) && !denies.has(PermissionFlagsBits.SendMessages),
                        manage: allows.has(PermissionFlagsBits.ManageChannels),
                        denied: denies.has(PermissionFlagsBits.ViewChannel)
                    };
                } else if (channel.parent) {
                    // Check if role has permissions on parent category
                    const parentOverwrites = channel.parent.permissionOverwrites.cache.get(role.id);
                    if (parentOverwrites) {
                        channelPerms.permissions[role.name] = {
                            inherits: true,
                            from: channel.parent.name
                        };
                    }
                }
            }

            // Detect missing role restrictions for specialty channels
            const specialChannelPatterns = [
                { pattern: /gam(e|ing)/i, expectedRole: 'Gamer' },
                { pattern: /art|creative|craft/i, expectedRole: 'Artist' },
                { pattern: /music/i, expectedRole: 'Music Lover' },
                { pattern: /photo/i, expectedRole: 'Photographer' },
                { pattern: /movie|film/i, expectedRole: 'Movie Buff' },
                { pattern: /read|writ|book|library/i, expectedRole: 'Reader/Writer' }
            ];

            for (const { pattern, expectedRole } of specialChannelPatterns) {
                if (pattern.test(channel.name)) {
                    const role = guild.roles.cache.find(r => r.name === expectedRole);
                    if (role && !channelPerms.permissions[expectedRole]) {
                        channelPerms.issues.push(`Missing "${expectedRole}" role restriction - channel may be visible to non-members`);
                    }
                }
            }

            if (!showIssuesOnly || channelPerms.issues.length > 0) {
                audit.push(channelPerms);
                if (channelPerms.issues.length > 0) issues.push(`#${channel.name}: ${channelPerms.issues.join(', ')}`);
            }
        }

        return {
            success: true,
            total_channels: audit.length,
            total_issues: issues.length,
            audit_results: audit,
            issues_summary: issues,
            recommendations: [
                '1. Deny @everyone ViewChannel on categories containing role-restricted channels',
                '2. Explicitly allow specific roles on their designated channels',
                '3. Remove unnecessary @everyone permissions on specialty channels',
                '4. Use category-level permissions to reduce per-channel overwrites',
                '5. Verify pronoun role channels are visible to all members'
            ]
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to audit permissions: ${error.message}`
        };
    }
}

// ===== HELPER FUNCTIONS =====

async function assignRole(guild, author, input) {
    const roleService = require('../services/roleService');
    const { isOwner } = require('../utils/permissions');
    const targetUserId = input.userId || author.id;

    try {
        // Get the member with retry logic
        const member = await retryWithBackoff(
            () => guild.members.fetch(targetUserId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Member'
            }
        );

        // If owner is requesting, bypass self-assignable check
        if (isOwner(author.id)) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === input.roleName.toLowerCase());

            if (!role) {
                return {
                    success: false,
                    error: `Role "${input.roleName}" not found`
                };
            }

            if (member.roles.cache.has(role.id)) {
                return {
                    success: false,
                    error: `${member.user.username} already has the ${input.roleName} role`
                };
            }

            await retryWithBackoff(
                () => member.roles.add(role),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Add Role'
                }
            );
            return {
                success: true,
                message: `Added ${input.roleName} role to ${member.user.username}`
            };
        }

        // For non-owners, use roleService (self-assignable roles only)
        const result = await roleService.addRole(member, input.roleName);

        if (result.success) {
            return {
                success: true,
                message: `Added ${input.roleName} role to ${member.user.username}`
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Failed to assign role: ${error.message}`
        };
    }
}

async function removeRole(guild, author, input) {
    const roleService = require('../services/roleService');
    const { isOwner } = require('../utils/permissions');
    const targetUserId = input.userId || author.id;

    try {
        const member = await retryWithBackoff(
            () => guild.members.fetch(targetUserId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Member'
            }
        );

        // If owner is requesting, bypass self-assignable check
        if (isOwner(author.id)) {
            const role = guild.roles.cache.find(r => r.name.toLowerCase() === input.roleName.toLowerCase());

            if (!role) {
                return {
                    success: false,
                    error: `Role "${input.roleName}" not found`
                };
            }

            if (!member.roles.cache.has(role.id)) {
                return {
                    success: false,
                    error: `${member.user.username} doesn't have the ${input.roleName} role`
                };
            }

            await retryWithBackoff(
                () => member.roles.remove(role),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Remove Role'
                }
            );
            return {
                success: true,
                message: `Removed ${input.roleName} role from ${member.user.username}`
            };
        }

        // For non-owners, use roleService (self-assignable roles only)
        const result = await roleService.removeRole(member, input.roleName);

        if (result.success) {
            return {
                success: true,
                message: `Removed ${input.roleName} role from ${member.user.username}`
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        return {
            success: false,
            error: `Failed to remove role: ${error.message}`
        };
    }
}

async function createThreadInChannel(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channelName.toLowerCase());

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const thread = await channel.threads.create({
            name: input.threadName,
            autoArchiveDuration: input.autoArchiveDuration || 60,
            reason: 'Created by Sunny'
        });

        return {
            success: true,
            message: `Created thread "${input.threadName}" in #${input.channelName}`,
            thread_id: thread.id
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to create thread: ${error.message}`
        };
    }
}

async function deleteScheduledEvent(guild, input) {
    try {
        const events = await guild.scheduledEvents.fetch();
        const event = events.find(e => e.name.toLowerCase() === input.eventName.toLowerCase());

        if (!event) {
            return { success: false, error: `Event "${input.eventName}" not found` };
        }

        await event.delete();

        return {
            success: true,
            message: `Deleted event "${input.eventName}"`
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete event: ${error.message}`
        };
    }
}

async function deleteEmoji(guild, input) {
    try {
        const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === input.emojiName.toLowerCase());

        if (!emoji) {
            return { success: false, error: `Emoji "${input.emojiName}" not found` };
        }

        await emoji.delete();

        return {
            success: true,
            message: `Deleted emoji "${input.emojiName}"`
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to delete emoji: ${error.message}`
        };
    }
}

function getChannelTypeName(type) {
    const typeMap = {
        [ChannelType.GuildText]: 'Text',
        [ChannelType.GuildVoice]: 'Voice',
        [ChannelType.GuildCategory]: 'Category',
        [ChannelType.GuildForum]: 'Forum',
        [ChannelType.GuildStageVoice]: 'Stage',
        [ChannelType.PublicThread]: 'Thread',
        [ChannelType.PrivateThread]: 'Private Thread',
        [ChannelType.GuildAnnouncement]: 'Announcement'
    };

    return typeMap[type] || 'Unknown';
}

// Helper function to find channel by name or ID
function findChannel(guild, identifier) {
    if (!identifier) return null;

    // Try to find by ID first (if identifier looks like a snowflake ID)
    if (/^\d{17,19}$/.test(identifier)) {
        const channelById = guild.channels.cache.get(identifier);
        if (channelById) return channelById;
    }

    // Try to find by name (case-insensitive)
    return guild.channels.cache.find(c => c.name.toLowerCase() === identifier.toLowerCase());
}

// ===== MESSAGE MANAGEMENT IMPLEMENTATIONS =====

async function sendMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.send(input.content),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Message'
            }
        );

        return {
            success: true,
            message: `Message sent to #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to send message: ${error.message}` };
    }
}

async function sendEmbed(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const embed = new EmbedBuilder()
            .setDescription(input.description);

        if (input.title) embed.setTitle(input.title);
        if (input.color) embed.setColor(input.color);
        if (input.footer) embed.setFooter({ text: input.footer });
        if (input.imageUrl) embed.setImage(input.imageUrl);
        if (input.thumbnailUrl) embed.setThumbnail(input.thumbnailUrl);

        const message = await retryWithBackoff(
            () => channel.send({ embeds: [embed] }),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Embed'
            }
        );

        return {
            success: true,
            message: `Embed sent to #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to send embed: ${error.message}` };
    }
}

async function editMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.edit(input.newContent),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Edit Message'
            }
        );

        return {
            success: true,
            message: `Message edited in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to edit message: ${error.message}` };
    }
}

async function deleteMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.delete(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Delete Message'
            }
        );

        return {
            success: true,
            message: `Message deleted from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete message: ${error.message}` };
    }
}

async function pinMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.pin(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Pin Message'
            }
        );

        return {
            success: true,
            message: `Message pinned in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to pin message: ${error.message}` };
    }
}

async function unpinMessage(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.unpin(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Unpin Message'
            }
        );

        return {
            success: true,
            message: `Message unpinned from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to unpin message: ${error.message}` };
    }
}

async function purgeMessages(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const amount = Math.min(input.amount, 100);
        await retryWithBackoff(
            () => channel.bulkDelete(amount, true),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Bulk Delete Messages'
            }
        );

        return {
            success: true,
            message: `Purged ${amount} messages from #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to purge messages: ${error.message}` };
    }
}

async function getChannelMessages(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const limit = Math.min(input.limit || 50, 100);
        const messages = await retryWithBackoff(
            () => channel.messages.fetch({ limit }),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Channel Messages'
            }
        );

        const messageList = messages.map(m => ({
            id: m.id,
            author: m.author.username,
            author_id: m.author.id,
            author_bot: m.author.bot,
            content: m.content,
            timestamp: m.createdAt.toISOString(),
            embeds: m.embeds.map(e => ({
                title: e.title,
                description: e.description,
                color: e.color ? `#${e.color.toString(16).padStart(6, '0')}` : null,
                fields: e.fields.map(f => ({
                    name: f.name,
                    value: f.value,
                    inline: f.inline
                })),
                footer: e.footer ? { text: e.footer.text, icon: e.footer.iconURL } : null,
                image: e.image?.url || null,
                thumbnail: e.thumbnail?.url || null,
                author: e.author ? {
                    name: e.author.name,
                    iconURL: e.author.iconURL,
                    url: e.author.url
                } : null,
                url: e.url || null,
                timestamp: e.timestamp || null
            })),
            attachments: m.attachments.map(a => ({
                name: a.name,
                url: a.url,
                size: a.size,
                contentType: a.contentType
            })),
            reactions: m.reactions.cache.map(r => ({
                emoji: r.emoji.name || r.emoji.toString(),
                count: r.count
            })),
            pinned: m.pinned,
            edited: m.editedAt ? m.editedAt.toISOString() : null
        }));

        return {
            success: true,
            messages: messageList,
            total: messageList.length,
            channel: channel.name,
            channel_id: channel.id
        };
    } catch (error) {
        return { success: false, error: `Failed to fetch channel messages: ${error.message}` };
    }
}

// ===== REACTION MANAGEMENT IMPLEMENTATIONS =====

async function addReaction(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        // Try to fetch the message with better error handling and retry logic
        let message;
        try {
            message = await retryWithBackoff(
                () => channel.messages.fetch(input.messageId),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Fetch Message for Reaction'
                }
            );
        } catch (fetchError) {
            if (fetchError.code === 10008) {
                return { success: false, error: `Message ${input.messageId} not found in #${channel.name}. The message may have been deleted or the ID is incorrect.` };
            }
            return { success: false, error: `Could not fetch message: ${fetchError.message} (Code: ${fetchError.code || 'unknown'})` };
        }

        // Try to add the reaction with retry logic
        try {
            await retryWithBackoff(
                () => message.react(input.emoji),
                {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    operationName: 'Add Reaction'
                }
            );
        } catch (reactError) {
            if (reactError.code === 10014) {
                return { success: false, error: `Invalid emoji: "${input.emoji}". Use Unicode emojis (like ✅) or custom emoji names from this server.` };
            }
            if (reactError.code === 50013) {
                return { success: false, error: `Missing permissions to add reactions in #${channel.name}. Bot needs "Add Reactions" permission.` };
            }
            return { success: false, error: `Failed to add reaction: ${reactError.message} (Code: ${reactError.code || 'unknown'})` };
        }

        return {
            success: true,
            message: `Added reaction ${input.emoji} to message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to add reaction: ${error.message}` };
    }
}

async function removeReaction(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );

        if (input.userId) {
            const userReaction = message.reactions.cache.find(r => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji);
            if (userReaction) {
                await userReaction.users.remove(input.userId);
            }
        } else {
            const reaction = message.reactions.cache.find(r => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji);
            if (reaction) {
                await reaction.remove();
            }
        }

        return {
            success: true,
            message: `Removed reaction ${input.emoji} from message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to remove reaction: ${error.message}` };
    }
}

async function removeAllReactions(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        const message = await retryWithBackoff(
            () => channel.messages.fetch(input.messageId),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Fetch Message'
            }
        );
        await retryWithBackoff(
            () => message.reactions.removeAll(),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Remove All Reactions'
            }
        );

        return {
            success: true,
            message: `Removed all reactions from message in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to remove all reactions: ${error.message}` };
    }
}

async function setupReactionRole(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.setupReactionRole(guild, input);
    } catch (error) {
        return { success: false, error: `Failed to setup reaction role: ${error.message}` };
    }
}

async function removeReactionRole(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.removeReactionRole(input);
    } catch (error) {
        return { success: false, error: `Failed to remove reaction role: ${error.message}` };
    }
}

async function listReactionRoles(guild, input) {
    try {
        const reactionRoleService = require('../services/reactionRoleService');
        return await reactionRoleService.listReactionRoles(guild);
    } catch (error) {
        return { success: false, error: `Failed to list reaction roles: ${error.message}` };
    }
}

async function sendButtonMessage(guild, input) {
    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found. Provide either the channel name or channel ID.` };
        }

        // Build message payload
        const messagePayload = {};

        // Add content if provided
        if (input.content) {
            messagePayload.content = input.content;
        }

        // Build embed if provided
        if (input.embed) {
            const embed = new EmbedBuilder();
            if (input.embed.title) embed.setTitle(input.embed.title);
            if (input.embed.description) embed.setDescription(input.embed.description);
            if (input.embed.color) embed.setColor(input.embed.color);
            if (input.embed.footer) embed.setFooter({ text: input.embed.footer });
            if (input.embed.thumbnail) embed.setThumbnail(input.embed.thumbnail);
            if (input.embed.image) embed.setImage(input.embed.image);
            if (input.embed.fields?.length) {
                for (const field of input.embed.fields) {
                    embed.addFields({
                        name: field.name,
                        value: field.value,
                        inline: field.inline || false
                    });
                }
            }
            messagePayload.embeds = [embed];
        }

        // Build buttons
        const rows = [];
        const styleMap = {
            'primary': ButtonStyle.Primary,
            'secondary': ButtonStyle.Secondary,
            'success': ButtonStyle.Success,
            'danger': ButtonStyle.Danger,
            'link': ButtonStyle.Link
        };

        // Group buttons into rows (max 5 buttons per row)
        for (let i = 0; i < input.buttons.length; i += 5) {
            const row = new ActionRowBuilder();
            const buttonsInRow = input.buttons.slice(i, i + 5);

            for (const buttonConfig of buttonsInRow) {
                const button = new ButtonBuilder()
                    .setLabel(buttonConfig.label)
                    .setStyle(styleMap[buttonConfig.style] || ButtonStyle.Primary);

                // Set custom ID or URL based on style
                if (buttonConfig.style === 'link') {
                    if (!buttonConfig.url) {
                        return { success: false, error: `Link button "${buttonConfig.label}" requires a URL` };
                    }
                    button.setURL(buttonConfig.url);
                } else {
                    button.setCustomId(buttonConfig.customId);
                }

                // Add emoji if provided
                if (buttonConfig.emoji) {
                    button.setEmoji(buttonConfig.emoji);
                }

                // Set disabled state
                if (buttonConfig.disabled) {
                    button.setDisabled(true);
                }

                row.addComponents(button);
            }

            rows.push(row);

            // Discord allows max 5 action rows
            if (rows.length >= 5) break;
        }

        messagePayload.components = rows;

        // Send the message
        const message = await retryWithBackoff(
            () => channel.send(messagePayload),
            {
                maxAttempts: 3,
                baseDelay: 1000,
                operationName: 'Send Button Message'
            }
        );

        return {
            success: true,
            message: `Button message sent to #${channel.name}`,
            message_id: message.id,
            button_count: input.buttons.length
        };
    } catch (error) {
        return { success: false, error: `Failed to send button message: ${error.message}` };
    }
}

// ===== INVITE MANAGEMENT IMPLEMENTATIONS =====

async function createInvite(guild, input) {
    try {
        const channel = guild.channels.cache.find(c => c.name.toLowerCase() === input.channelName.toLowerCase());

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const invite = await channel.createInvite({
            maxAge: input.maxAge || 0,
            maxUses: input.maxUses || 0,
            temporary: input.temporary || false
        });

        return {
            success: true,
            message: `Created invite: https://discord.gg/${invite.code}`,
            invite_code: invite.code,
            invite_url: `https://discord.gg/${invite.code}`
        };
    } catch (error) {
        return { success: false, error: `Failed to create invite: ${error.message}` };
    }
}

async function listInvites(guild, input) {
    try {
        const invites = await guild.invites.fetch();
        const inviteList = invites.map(i => ({
            code: i.code,
            url: `https://discord.gg/${i.code}`,
            uses: i.uses,
            max_uses: i.maxUses || 'Unlimited',
            expires: i.expiresAt ? i.expiresAt.toLocaleDateString() : 'Never',
            created_by: i.inviter?.username || 'Unknown'
        }));

        return {
            success: true,
            invites: inviteList,
            total: inviteList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list invites: ${error.message}` };
    }
}

async function listWebhooks(guild, input) {
    try {
        const webhooks = await guild.fetchWebhooks();
        const webhookList = webhooks.map(w => ({
            id: w.id,
            name: w.name,
            channel: w.channel?.name || 'Unknown',
            channel_id: w.channelId,
            created_by: w.owner?.username || 'Unknown',
            avatar: w.avatarURL() || 'None'
        }));

        return {
            success: true,
            webhooks: webhookList,
            total: webhookList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list webhooks: ${error.message}` };
    }
}

async function listEmojis(guild, input) {
    try {
        const emojis = guild.emojis.cache;
        const emojiList = emojis.map(e => ({
            id: e.id,
            name: e.name,
            animated: e.animated,
            url: e.url,
            created_by: e.author?.username || 'Unknown'
        }));

        return {
            success: true,
            emojis: emojiList,
            total: emojiList.length,
            message: emojiList.length === 0 ? 'No custom emojis in this server' : `Found ${emojiList.length} custom emoji(s)`
        };
    } catch (error) {
        return { success: false, error: `Failed to list emojis: ${error.message}` };
    }
}

async function listStickers(guild, input) {
    try {
        const stickers = guild.stickers.cache;
        const stickerList = stickers.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description || 'No description',
            tags: s.tags || 'None',
            url: s.url
        }));

        return {
            success: true,
            stickers: stickerList,
            total: stickerList.length,
            message: stickerList.length === 0 ? 'No custom stickers in this server' : `Found ${stickerList.length} custom sticker(s)`
        };
    } catch (error) {
        return { success: false, error: `Failed to list stickers: ${error.message}` };
    }
}

// ===== AUTOMODERATION IMPLEMENTATIONS =====

async function createAutoModRule(guild, input) {
    try {
        const { AutoModerationRuleTriggerType, AutoModerationActionType } = require('discord.js');

        let triggerType;
        let triggerMetadata = {};

        switch (input.triggerType) {
            case 'keyword':
                triggerType = AutoModerationRuleTriggerType.Keyword;
                triggerMetadata.keywordFilter = input.keywords || [];
                break;
            case 'spam':
                triggerType = AutoModerationRuleTriggerType.Spam;
                break;
            case 'mention_spam':
                triggerType = AutoModerationRuleTriggerType.MentionSpam;
                triggerMetadata.mentionTotalLimit = input.mentionLimit || 5;
                break;
            case 'harmful_link':
                triggerType = 4; // Harmful link filtering
                break;
        }

        const actions = [];

        if (input.action === 'block') {
            actions.push({
                type: AutoModerationActionType.BlockMessage
            });
        }

        if (input.action === 'timeout') {
            actions.push({
                type: AutoModerationActionType.Timeout,
                metadata: { durationSeconds: 60 }
            });
        }

        if (input.action === 'alert' && input.alertChannelName) {
            const alertChannel = guild.channels.cache.find(c => c.name.toLowerCase() === input.alertChannelName.toLowerCase());
            if (alertChannel) {
                actions.push({
                    type: AutoModerationActionType.SendAlertMessage,
                    metadata: { channelId: alertChannel.id }
                });
            }
        }

        const rule = await guild.autoModerationRules.create({
            name: input.ruleName,
            eventType: 1, // MESSAGE_SEND - Required parameter for AutoMod rules
            triggerType: triggerType,
            triggerMetadata: triggerMetadata,
            actions: actions,
            enabled: true
        });

        return {
            success: true,
            message: `Created AutoMod rule: ${input.ruleName}`,
            rule_id: rule.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create AutoMod rule: ${error.message}` };
    }
}

async function listAutoModRules(guild, input) {
    try {
        const rules = await guild.autoModerationRules.fetch();
        const ruleList = rules.map(r => ({
            name: r.name,
            trigger_type: r.triggerType,
            enabled: r.enabled,
            actions: r.actions.length
        }));

        return {
            success: true,
            rules: ruleList,
            total: ruleList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list AutoMod rules: ${error.message}` };
    }
}

async function deleteAutoModRule(guild, input) {
    try {
        const rules = await guild.autoModerationRules.fetch();
        const rule = rules.find(r => r.name.toLowerCase() === input.ruleName.toLowerCase());

        if (!rule) {
            return { success: false, error: `AutoMod rule "${input.ruleName}" not found` };
        }

        await rule.delete();

        return {
            success: true,
            message: `Deleted AutoMod rule: ${input.ruleName}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete AutoMod rule: ${error.message}` };
    }
}

// ===== MODERATION LOGS IMPLEMENTATIONS =====

async function getAuditLogs(guild, input) {
    try {
        const limit = Math.min(input.limit || 10, 100);
        const logs = await guild.fetchAuditLogs({ limit });

        const logList = logs.entries.map(entry => ({
            action: entry.actionType,
            executor: entry.executor?.username || 'Unknown',
            target: entry.target?.username || entry.target?.name || 'Unknown',
            reason: entry.reason || 'No reason provided',
            timestamp: entry.createdAt.toLocaleString()
        }));

        return {
            success: true,
            logs: logList,
            total: logList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get audit logs: ${error.message}` };
    }
}

async function getBans(guild, input) {
    try {
        const bans = await guild.bans.fetch();
        const banList = bans.map(ban => ({
            user: ban.user.username,
            user_id: ban.user.id,
            reason: ban.reason || 'No reason provided'
        }));

        return {
            success: true,
            bans: banList,
            total: banList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get bans: ${error.message}` };
    }
}

// ===== AUTOMATIC MESSAGE IMPLEMENTATIONS =====

async function createAutoMessage(guild, input) {
    try {
        // Find channel by name
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const config = {
            messageType: input.messageType,
            channelId: channel.id,
            content: input.content,
            embedConfig: input.embedConfig,
            triggers: input.triggers,
            dmUser: input.dmUser,
            enabled: input.enabled !== false
        };

        const autoMessage = await autoMessageService.createAutoMessage(guild.id, config);

        return {
            success: true,
            message: `Created ${input.messageType} automatic message for #${channel.name}`,
            message_id: autoMessage._id.toString()
        };
    } catch (error) {
        return { success: false, error: `Failed to create automatic message: ${error.message}` };
    }
}

async function listAutoMessages(guild, input) {
    try {
        const filters = {};
        if (input.messageType) filters.messageType = input.messageType;
        if (input.enabled !== undefined) filters.enabled = input.enabled;

        const messages = await autoMessageService.listAutoMessages(guild.id, filters);

        const messageList = messages.map(m => ({
            id: m._id.toString(),
            type: m.messageType,
            channel: guild.channels.cache.get(m.channelId)?.name || 'Unknown',
            enabled: m.enabled,
            content: m.content?.substring(0, 50) + (m.content?.length > 50 ? '...' : ''),
            has_embed: m.embedConfig?.enabled || false
        }));

        return {
            success: true,
            messages: messageList,
            total: messageList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list automatic messages: ${error.message}` };
    }
}

async function updateAutoMessage(guild, input) {
    try {
        const updates = input.updates;

        // If channel name is provided, convert to channel ID
        if (updates.channelName) {
            const channel = findChannel(guild, updates.channelName);
            if (!channel) {
                return { success: false, error: `Channel "${updates.channelName}" not found` };
            }
            updates.channelId = channel.id;
            delete updates.channelName;
        }

        await autoMessageService.updateAutoMessage(input.messageId, updates);

        return {
            success: true,
            message: `Updated automatic message ${input.messageId}`
        };
    } catch (error) {
        return { success: false, error: `Failed to update automatic message: ${error.message}` };
    }
}

async function deleteAutoMessage(guild, input) {
    try {
        await autoMessageService.deleteAutoMessage(input.messageId);

        return {
            success: true,
            message: `Deleted automatic message ${input.messageId}`
        };
    } catch (error) {
        return { success: false, error: `Failed to delete automatic message: ${error.message}` };
    }
}

async function getAutoMessage(guild, input) {
    try {
        const message = await autoMessageService.getAutoMessage(input.messageId);

        if (!message) {
            return { success: false, error: `Automatic message ${input.messageId} not found` };
        }

        return {
            success: true,
            message: {
                id: message._id.toString(),
                type: message.messageType,
                channel: guild.channels.cache.get(message.channelId)?.name || 'Unknown',
                content: message.content,
                embed_config: message.embedConfig,
                triggers: message.triggers,
                enabled: message.enabled,
                dm_user: message.dmUser
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get automatic message: ${error.message}` };
    }
}

async function enableAutoMessages(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        const featureMap = {
            'welcome': 'welcomeEnabled',
            'goodbye': 'goodbyeEnabled',
            'milestones': 'milestonesEnabled',
            'triggers': 'triggersEnabled'
        };

        const field = featureMap[input.featureType];
        if (!field) {
            return { success: false, error: `Invalid feature type: ${input.featureType}` };
        }

        if (!settings.autoMessages) settings.autoMessages = {};
        settings.autoMessages[field] = true;
        await settings.save();

        return {
            success: true,
            message: `Enabled ${input.featureType} automatic messages`
        };
    } catch (error) {
        return { success: false, error: `Failed to enable automatic messages: ${error.message}` };
    }
}

async function disableAutoMessages(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        if (!settings) {
            return { success: false, error: 'Server settings not found' };
        }

        const featureMap = {
            'welcome': 'welcomeEnabled',
            'goodbye': 'goodbyeEnabled',
            'milestones': 'milestonesEnabled',
            'triggers': 'triggersEnabled'
        };

        const field = featureMap[input.featureType];
        if (!field) {
            return { success: false, error: `Invalid feature type: ${input.featureType}` };
        }

        if (!settings.autoMessages) settings.autoMessages = {};
        settings.autoMessages[field] = false;
        await settings.save();

        return {
            success: true,
            message: `Disabled ${input.featureType} automatic messages`
        };
    } catch (error) {
        return { success: false, error: `Failed to disable automatic messages: ${error.message}` };
    }
}

// ===== TICKETING SYSTEM IMPLEMENTATIONS =====

async function createTicket(guild, input) {
    try {
        // Find member by name
        const member = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.memberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.memberName.toLowerCase()
        );

        if (!member) {
            return { success: false, error: `Member "${input.memberName}" not found` };
        }

        const result = await ticketService.createTicket(
            guild,
            member,
            input.category,
            input.subject,
            input.description
        );

        return {
            success: true,
            message: `Created ticket #${result.ticket.ticketNumber} for ${member.user.username}`,
            ticket_id: result.ticket.ticketId,
            thread_id: result.thread.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create ticket: ${error.message}` };
    }
}

async function closeTicket(guild, input) {
    try {
        // Find staff member by name
        const staffMember = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.staffMemberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.staffMemberName.toLowerCase()
        );

        if (!staffMember) {
            return { success: false, error: `Staff member "${input.staffMemberName}" not found` };
        }

        const ticket = await ticketService.closeTicket(
            input.ticketId,
            staffMember,
            input.reason
        );

        return {
            success: true,
            message: `Closed ticket #${ticket.ticketNumber}`,
            transcript_url: ticket.transcriptUrl
        };
    } catch (error) {
        return { success: false, error: `Failed to close ticket: ${error.message}` };
    }
}

async function assignTicket(guild, input) {
    try {
        // Find staff member by name
        const staffMember = guild.members.cache.find(m => 
            m.user.username.toLowerCase() === input.staffMemberName.toLowerCase() ||
            m.displayName.toLowerCase() === input.staffMemberName.toLowerCase()
        );

        if (!staffMember) {
            return { success: false, error: `Staff member "${input.staffMemberName}" not found` };
        }

        const ticket = await ticketService.assignTicket(input.ticketId, staffMember);

        return {
            success: true,
            message: `Assigned ticket #${ticket.ticketNumber} to ${staffMember.user.username}`
        };
    } catch (error) {
        return { success: false, error: `Failed to assign ticket: ${error.message}` };
    }
}

async function updateTicketPriority(guild, input) {
    try {
        const ticket = await ticketService.updateTicketPriority(input.ticketId, input.priority);

        return {
            success: true,
            message: `Updated ticket #${ticket.ticketNumber} priority to ${input.priority}`
        };
    } catch (error) {
        return { success: false, error: `Failed to update ticket priority: ${error.message}` };
    }
}

async function listTickets(guild, input) {
    try {
        const filters = {};
        if (input.status) filters.status = input.status;
        if (input.category) filters.category = input.category;

        // Convert member names to IDs if provided
        if (input.assignedToName) {
            const member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === input.assignedToName.toLowerCase() ||
                m.displayName.toLowerCase() === input.assignedToName.toLowerCase()
            );
            if (member) filters.assignedTo = member.id;
        }

        if (input.creatorName) {
            const member = guild.members.cache.find(m => 
                m.user.username.toLowerCase() === input.creatorName.toLowerCase() ||
                m.displayName.toLowerCase() === input.creatorName.toLowerCase()
            );
            if (member) filters.creatorId = member.id;
        }

        const tickets = await ticketService.listTickets(guild.id, filters);

        const ticketList = tickets.map(t => ({
            ticket_number: t.ticketNumber,
            ticket_id: t.ticketId,
            subject: t.subject,
            category: t.category,
            status: t.status,
            priority: t.priority,
            creator: guild.members.cache.get(t.creatorId)?.user.username || 'Unknown',
            assigned_to: t.assignedTo ? (guild.members.cache.get(t.assignedTo)?.user.username || 'Unknown') : 'Unassigned',
            created_at: t.createdAt.toLocaleDateString()
        }));

        return {
            success: true,
            tickets: ticketList,
            total: ticketList.length
        };
    } catch (error) {
        return { success: false, error: `Failed to list tickets: ${error.message}` };
    }
}

async function getTicketStats(guild, input) {
    try {
        const stats = await ticketService.getTicketStats(guild.id);

        return {
            success: true,
            stats: {
                total: stats.total,
                open: stats.open,
                in_progress: stats.inProgress,
                closed: stats.closed,
                by_category: stats.byCategory,
                avg_resolution_time: ticketService.formatDuration(stats.avgResolutionTime),
                avg_first_response_time: ticketService.formatDuration(stats.avgFirstResponseTime)
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get ticket stats: ${error.message}` };
    }
}

async function getTicket(guild, input) {
    try {
        const ticket = await ticketService.getTicket(input.ticketId);

        if (!ticket) {
            return { success: false, error: `Ticket ${input.ticketId} not found` };
        }

        return {
            success: true,
            ticket: {
                ticket_number: ticket.ticketNumber,
                ticket_id: ticket.ticketId,
                subject: ticket.subject,
                description: ticket.description,
                category: ticket.category,
                status: ticket.status,
                priority: ticket.priority,
                creator: guild.members.cache.get(ticket.creatorId)?.user.username || 'Unknown',
                assigned_to: ticket.assignedTo ? (guild.members.cache.get(ticket.assignedTo)?.user.username || 'Unknown') : 'Unassigned',
                tags: ticket.tags,
                created_at: ticket.createdAt.toLocaleString(),
                closed_at: ticket.closedAt?.toLocaleString() || 'Not closed',
                transcript_url: ticket.transcriptUrl
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get ticket: ${error.message}` };
    }
}

async function addTicketTag(guild, input) {
    try {
        const ticket = await ticketService.addTicketTag(input.ticketId, input.tag);

        return {
            success: true,
            message: `Added tag "${input.tag}" to ticket #${ticket.ticketNumber}`
        };
    } catch (error) {
        return { success: false, error: `Failed to add ticket tag: ${error.message}` };
    }
}

async function enableTicketing(guild, input) {
    try {
        // Find channels
        const supportChannel = findChannel(guild, input.supportChannelName);
        if (!supportChannel) {
            return { success: false, error: `Support channel "${input.supportChannelName}" not found` };
        }

        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        if (!settings.ticketing) settings.ticketing = {};
        settings.ticketing.enabled = true;
        settings.ticketing.supportChannelId = supportChannel.id;

        // Optional: staff notify channel
        if (input.staffNotifyChannelName) {
            const notifyChannel = findChannel(guild, input.staffNotifyChannelName);
            if (notifyChannel) {
                settings.ticketing.staffNotifyChannelId = notifyChannel.id;
            }
        }

        // Optional: transcript channel
        if (input.transcriptChannelName) {
            const transcriptChannel = findChannel(guild, input.transcriptChannelName);
            if (transcriptChannel) {
                settings.ticketing.transcripts = settings.ticketing.transcripts || {};
                settings.ticketing.transcripts.enabled = true;
                settings.ticketing.transcripts.channelId = transcriptChannel.id;
            }
        }

        // Optional: staff roles
        if (input.staffRoleNames?.length) {
            const roleIds = [];
            for (const roleName of input.staffRoleNames) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                if (role) roleIds.push(role.id);
            }
            settings.ticketing.staffRoleIds = roleIds;
        }

        await settings.save();

        return {
            success: true,
            message: `Enabled ticketing system with support channel #${supportChannel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to enable ticketing: ${error.message}` };
    }
}

async function disableTicketing(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id });
        if (!settings) {
            return { success: false, error: 'Server settings not found' };
        }

        if (!settings.ticketing) settings.ticketing = {};
        settings.ticketing.enabled = false;
        await settings.save();

        return {
            success: true,
            message: 'Disabled ticketing system'
        };
    } catch (error) {
        return { success: false, error: `Failed to disable ticketing: ${error.message}` };
    }
}

async function configureTicketCategories(guild, input) {
    try {
        const settings = await ServerSettings.findOne({ guildId: guild.id }) || new ServerSettings({ guildId: guild.id });

        if (!settings.ticketing) settings.ticketing = {};

        // Convert role names to IDs
        const categories = input.categories.map(cat => {
            const result = {
                name: cat.name,
                emoji: cat.emoji
            };

            if (cat.autoAssignRoleName) {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === cat.autoAssignRoleName.toLowerCase());
                if (role) result.autoAssignRoleId = role.id;
            }

            return result;
        });

        settings.ticketing.categories = categories;
        await settings.save();

        return {
            success: true,
            message: `Configured ${categories.length} ticket categories`
        };
    } catch (error) {
        return { success: false, error: `Failed to configure ticket categories: ${error.message}` };
    }
}

// ===== GAME AND ENTERTAINMENT IMPLEMENTATIONS =====

/**
 * Generate and post a single trivia question
 * @param {Guild} guild - Discord guild
 * @param {Object} input - Tool input
 * @returns {Promise<Object>} Result object
 */
async function generateSingleTriviaQuestion(guild, input) {
    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const OpenAI = require('openai');
        
        // Find channel
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const category = input.category || 'general';
        const difficulty = input.difficulty || 'medium';

        // Initialize Z.AI client
        const aiClient = new OpenAI({
            apiKey: process.env.ZAI_API_KEY,
            baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4/'
        });

        // Generate question using Z.AI
        const prompt = `Generate a ${difficulty} trivia question about ${category}.

Return ONLY a JSON object in this exact format (no markdown, no extra text):
{
  "question": "The trivia question here",
  "answers": ["Answer A", "Answer B", "Answer C", "Answer D"],
  "correct": 0,
  "category": "${category}",
  "explanation": "Brief explanation of why this is the correct answer"
}

Rules:
- The question should be appropriate for all ages but intellectually challenging
- Make exactly 4 answer options
- The correct answer index (0-3) should be randomized
- All answers should be highly plausible to make it challenging
- ${difficulty === 'easy' ? 'Make the question accessible but interesting' : difficulty === 'hard' ? 'Make the question very challenging, requiring specialized knowledge' : 'Make the question moderately challenging'}
- The question should be factual and verifiable
- IMPORTANT: Generate a completely UNIQUE question`;

        console.log('🎲 Generating single trivia question...', {
            category,
            difficulty,
            provider: 'zai',
            model: 'glm-4.6'
        });

        const response = await aiClient.chat.completions.create({
            model: 'glm-4.6',
            max_tokens: 800,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: 'You are a trivia question generator. You MUST respond with valid JSON only, no other text.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const content = response.choices[0].message.content;
        console.log('📝 Raw AI response:', content.substring(0, 200) + '...');

        // Parse JSON response
        const jsonStr = content.replace(/```json\n?|```\n?/g, '').trim();
        const question = JSON.parse(jsonStr);

        // Validate question format
        if (!question.question || !Array.isArray(question.answers) || 
            question.answers.length !== 4 || typeof question.correct !== 'number') {
            throw new Error('Invalid question format from AI');
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#00CED1')
            .setTitle('🧠 Trivia Question!')
            .setDescription(question.question)
            .addFields(
                question.answers.map((answer, index) => ({
                    name: `${['A', 'B', 'C', 'D'][index]}`,
                    value: answer,
                    inline: true
                }))
            )
            .setFooter({ text: `${category} | ${difficulty} | 20 seconds to answer!` });

        // Create answer buttons
        const gameId = `trivia_${channel.id}_${Date.now()}`;
        const row = new ActionRowBuilder()
            .addComponents(
                ['A', 'B', 'C', 'D'].map(letter => 
                    new ButtonBuilder()
                        .setCustomId(`trivia_${letter}_${gameId}`)
                        .setLabel(letter)
                        .setStyle(ButtonStyle.Primary)
                )
            );

        // Post question
        const triviaMessage = await channel.send({ embeds: [embed], components: [row] });

        // Store game state in activeGames
        const gameState = {
            type: 'trivia',
            channelId: channel.id,
            question: question,
            messageId: triviaMessage.id,
            startTime: Date.now(),
            participants: new Map(),
            ended: false
        };
        gameService.activeGames.set(gameId, gameState);

        // Set timer for 20 seconds
        setTimeout(async () => {
            gameState.ended = true;
            
            // Disable buttons
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    row.components.map(button => 
                        ButtonBuilder.from(button).setDisabled(true)
                    )
                );
            
            try {
                await triviaMessage.edit({ components: [disabledRow] });
            } catch (err) {
                console.error('Failed to disable buttons:', err.message);
            }
            
            // Show results
            const correctUsers = [];
            for (const [userId, answer] of gameState.participants) {
                if (answer === question.correct) {
                    correctUsers.push(`<@${userId}>`);
                }
            }
            
            const correctLetter = ['A', 'B', 'C', 'D'][question.correct];
            const correctAnswer = question.answers[question.correct];
            
            const resultsEmbed = new EmbedBuilder()
                .setColor(correctUsers.length > 0 ? '#00FF00' : '#FF0000')
                .setTitle(`✅ Answer: ${correctLetter}. ${correctAnswer}`)
                .setDescription(
                    (question.explanation ? `💡 ${question.explanation}\n\n` : '') +
                    (correctUsers.length > 0 
                        ? `**Got it right:** ${correctUsers.join(', ')}` 
                        : gameState.participants.size > 0 
                            ? '**Nobody got this one!**' 
                            : '**Nobody answered!**')
                );
            
            await channel.send({ embeds: [resultsEmbed] });
            
            // Clean up
            gameService.activeGames.delete(gameId);
        }, 20000);

        return {
            success: true,
            message: `Generated trivia question about ${category}`,
            question: question.question,
            category: category,
            difficulty: difficulty
        };
    } catch (error) {
        console.error('❌ Failed to generate trivia question:', error);
        return { 
            success: false, 
            error: `Failed to generate trivia question: ${error.message}` 
        };
    }
}

async function startTrivia(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const result = await gameService.startTrivia(channel, {
            category: input.category,
            difficulty: input.difficulty,
            questionCount: input.questionCount
        });

        return result;
    } catch (error) {
        return { success: false, error: `Failed to start trivia: ${error.message}` };
    }
}

async function getTriviaLeaderboard(guild, input) {
    try {
        const leaderboard = await gameService.getLeaderboard(guild.id, 'trivia', input.limit || 10);

        return {
            success: true,
            leaderboard: leaderboard,
            total: leaderboard.length
        };
    } catch (error) {
        return { success: false, error: `Failed to get trivia leaderboard: ${error.message}` };
    }
}

async function createPoll(guild, input) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const pollData = await gameService.createPoll(input);
        if (!pollData.success) {
            return pollData;
        }

        // Send poll to channel
        const message = await channel.send({ poll: pollData.poll });

        return {
            success: true,
            message: `Created poll in #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create poll: ${error.message}` };
    }
}

async function createQuickPoll(guild, input) {
    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const embed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('📊 Quick Poll')
            .setDescription(input.question)
            .setFooter({ text: 'Click a button to vote!' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('poll_yes')
                    .setLabel('Yes')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('poll_no')
                    .setLabel('No')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('poll_maybe')
                    .setLabel('Maybe')
                    .setEmoji('🤔')
                    .setStyle(ButtonStyle.Secondary)
            );

        const message = await channel.send({ embeds: [embed], components: [row] });

        return {
            success: true,
            message: `Created quick poll in #${channel.name}`,
            message_id: message.id
        };
    } catch (error) {
        return { success: false, error: `Failed to create quick poll: ${error.message}` };
    }
}

async function startRockPaperScissors(guild, input, author) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        let opponent = null;
        if (input.opponent) {
            const member = guild.members.cache.find(m =>
                m.user.username.toLowerCase() === input.opponent.toLowerCase() ||
                m.displayName.toLowerCase() === input.opponent.toLowerCase()
            );
            if (member) opponent = member.user;
        }

        // Use the actual message author if available, otherwise create fallback
        let initiator = author;
        if (!initiator) {
            try {
                const ownerMember = guild.members.cache.get(guild.ownerId);
                if (ownerMember && ownerMember.user) {
                    initiator = ownerMember.user;
                } else {
                    // Create a basic user object as fallback
                    initiator = { 
                        id: guild.ownerId || 'unknown', 
                        username: 'Player',
                        displayName: 'Player'
                    };
                }
            } catch (err) {
                console.log('Failed to get guild owner, using fallback:', err.message);
                initiator = { 
                    id: 'unknown', 
                    username: 'Player',
                    displayName: 'Player'
                };
            }
        }

        const result = await gameService.startRockPaperScissors(channel, initiator, opponent);

        return result;
    } catch (error) {
        return { success: false, error: `Failed to start Rock Paper Scissors: ${error.message}` };
    }
}

async function startNumberGuess(guild, input, author) {
    try {
        const channel = findChannel(guild, input.channelName);
        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        // Use the actual message author if available, otherwise create fallback
        let user = author;
        if (!user) {
            try {
                const ownerMember = guild.members.cache.get(guild.ownerId);
                if (ownerMember && ownerMember.user) {
                    user = ownerMember.user;
                } else {
                    // Create a basic user object as fallback
                    user = { 
                        id: guild.ownerId || 'unknown', 
                        username: 'Player',
                        displayName: 'Player'
                    };
                }
            } catch (err) {
                console.log('Failed to get guild owner for number guess, using fallback:', err.message);
                user = { 
                    id: 'unknown', 
                    username: 'Player',
                    displayName: 'Player'
                };
            }
        }

        const result = await gameService.startNumberGuessing(channel, user, {
            min: input.min,
            max: input.max,
            maxGuesses: input.maxGuesses
        });

        return result;
    } catch (error) {
        return { success: false, error: `Failed to start number guessing: ${error.message}` };
    }
}

async function rollDice(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const sides = input.sides || 6;
        const count = input.count || 1;
        const rolls = [];
        let total = 0;

        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🎲 Dice Roll!')
            .setDescription(`Rolling ${count}d${sides}...`)
            .addFields(
                { name: 'Rolls', value: rolls.join(', '), inline: true },
                { name: 'Total', value: `**${total}**`, inline: true }
            );

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Rolled ${count}d${sides} in #${channel.name}: ${rolls.join(', ')} (Total: ${total})`
        };
    } catch (error) {
        return { success: false, error: `Failed to roll dice: ${error.message}` };
    }
}

async function flipCoin(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '🔄';

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${emoji} Coin Flip!`)
            .setDescription(`The coin landed on **${result}**!`);

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Flipped coin in #${channel.name}: ${result}`
        };
    } catch (error) {
        return { success: false, error: `Failed to flip coin: ${error.message}` };
    }
}

async function magic8Ball(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const responses = [
            'It is certain.',
            'It is decidedly so.',
            'Without a doubt.',
            'Yes definitely.',
            'You may rely on it.',
            'As I see it, yes.',
            'Most likely.',
            'Outlook good.',
            'Yes.',
            'Signs point to yes.',
            'Reply hazy, try again.',
            'Ask again later.',
            'Better not tell you now.',
            'Cannot predict now.',
            'Concentrate and ask again.',
            "Don't count on it.",
            'My reply is no.',
            'My sources say no.',
            'Outlook not so good.',
            'Very doubtful.'
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        const embed = new EmbedBuilder()
            .setColor('#8B008B')
            .setTitle('🔮 Magic 8-Ball')
            .addFields(
                { name: 'Question', value: input.question },
                { name: 'Answer', value: `**${response}**` }
            );

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Magic 8-ball answered in #${channel.name}: ${response}`
        };
    } catch (error) {
        return { success: false, error: `Failed to use magic 8-ball: ${error.message}` };
    }
}

async function getRandomFact(guild, input) {
    try {
        const { EmbedBuilder } = require('discord.js');
        const channel = findChannel(guild, input.channelName);

        if (!channel) {
            return { success: false, error: `Channel "${input.channelName}" not found` };
        }

        const facts = {
            general: [
                'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old!',
                'Octopuses have three hearts and blue blood.',
                'Bananas are berries, but strawberries are not.',
                'The shortest war in history lasted 38-45 minutes.',
                'A group of flamingos is called a "flamboyance".'
            ],
            science: [
                'Water can exist in three states at once (triple point).',
                'Diamond is not the hardest natural material anymore - wurtzite boron nitride is harder.',
                'One teaspoon of a neutron star would weigh about 6 billion tons.',
                'Glass is neither liquid nor solid, but an amorphous solid.',
                'The human brain uses about 20% of the body\'s energy despite being only 2% of body weight.'
            ],
            history: [
                'Oxford University is older than the Aztec Empire.',
                'Cleopatra lived closer to the moon landing than to the construction of the pyramids.',
                'The Great Wall of China is not visible from space without aid.',
                'Vikings never wore horned helmets.',
                'Napoleon was actually average height for his time.'
            ],
            space: [
                'A day on Venus is longer than its year.',
                'Saturn\'s moon Titan has rivers and lakes of liquid methane.',
                'There are more stars in the universe than grains of sand on Earth.',
                'The footprints on the moon will last for millions of years.',
                'Jupiter\'s Great Red Spot is shrinking.'
            ],
            animals: [
                'Dolphins have names for each other.',
                'Crows can hold grudges and recognize human faces.',
                'Sea otters hold hands while sleeping to keep from drifting apart.',
                'Penguins propose to their mates with pebbles.',
                'Elephants are afraid of bees.'
            ],
            food: [
                'Peanuts are not nuts, they\'re legumes.',
                'Carrots were originally purple.',
                'Vanilla is the second most expensive spice after saffron.',
                'Apples float in water because they are 25% air.',
                'Chocolate was once used as currency.'
            ]
        };

        const category = input.category || 'general';
        const categoryFacts = facts[category] || facts.general;
        const fact = categoryFacts[Math.floor(Math.random() * categoryFacts.length)];

        const embed = new EmbedBuilder()
            .setColor('#00CED1')
            .setTitle('💡 Random Fact')
            .setDescription(fact)
            .setFooter({ text: `Category: ${category}` });

        await channel.send({ embeds: [embed] });

        return {
            success: true,
            message: `Shared a ${category} fact in #${channel.name}`
        };
    } catch (error) {
        return { success: false, error: `Failed to get random fact: ${error.message}` };
    }
}

async function getGameLeaderboard(guild, input) {
    try {
        const gameType = input.gameType === 'all' ? null : input.gameType;
        const leaderboard = await gameService.getLeaderboard(guild.id, gameType, input.limit || 10);

        return {
            success: true,
            leaderboard: leaderboard,
            total: leaderboard.length,
            game_type: input.gameType
        };
    } catch (error) {
        return { success: false, error: `Failed to get game leaderboard: ${error.message}` };
    }
}

async function getUserGameStats(guild, input) {
    try {
        const user = guild.members.cache.find(m =>
            m.user.username.toLowerCase() === input.username.toLowerCase() ||
            m.displayName.toLowerCase() === input.username.toLowerCase()
        );

        if (!user) {
            return { success: false, error: `User "${input.username}" not found` };
        }

        const UserMemory = require('../models/UserMemory');
        const stats = await UserMemory.findOne({ userId: user.id, guildId: guild.id });

        if (!stats || !stats.games) {
            return {
                success: true,
                stats: {
                    username: user.user.username,
                    total_plays: 0,
                    message: 'No game stats found for this user'
                }
            };
        }

        return {
            success: true,
            stats: {
                username: user.user.username,
                total_plays: stats.games.totalPlays || 0,
                trivia: stats.games.trivia || { plays: 0, totalScore: 0, highScore: 0 },
                rps: stats.games.rps || { plays: 0, totalScore: 0 },
                number_guess: stats.games.number_guess || { plays: 0, totalScore: 0 }
            }
        };
    } catch (error) {
        return { success: false, error: `Failed to get user game stats: ${error.message}` };
    }
}

// ===== AGI LEARNING SYSTEM TOOL IMPLEMENTATIONS =====

/**
 * Analyze AI interaction outcomes for learning insights
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeOutcomes(guild, input) {
    try {
        const days = Math.min(input.days || 7, 30); // Default 7 days, max 30
        const filterBy = input.filter_by || 'all';

        // Build filters for getRecentOutcomes
        const filters = { guildId: guild.id };
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        filters.timestamp = { $gte: since };

        if (filterBy === 'successful') {
            filters.success = true;
        } else if (filterBy === 'failed') {
            filters.success = false;
        } else if (filterBy === 'positive_feedback') {
            filters.userSatisfaction = 1;
        } else if (filterBy === 'negative_feedback') {
            filters.userSatisfaction = -1;
        }

        // Get statistics and recent outcomes
        const [stats, outcomes] = await Promise.all([
            outcomeTracker.getStats(days),
            outcomeTracker.getRecentOutcomes(filters, 1000)
        ]);

        if (!stats || stats.total === 0) {
            return {
                success: true,
                analysis: {
                    period_days: days,
                    filter: filterBy,
                    message: `No interaction data found for the last ${days} days.`,
                    total_interactions: 0
                }
            };
        }

        // Analyze tool usage
        const toolUsage = {};
        const errorBreakdown = {};
        let totalTools = 0;

        for (const outcome of outcomes) {
            // Count tool usage
            if (outcome.toolsUsed && outcome.toolsUsed.length > 0) {
                for (const tool of outcome.toolsUsed) {
                    toolUsage[tool] = (toolUsage[tool] || 0) + 1;
                    totalTools++;
                }
            }

            // Count errors
            if (outcome.errors && outcome.errors.length > 0) {
                for (const error of outcome.errors) {
                    const errorKey = error.tool || 'unknown';
                    if (!errorBreakdown[errorKey]) {
                        errorBreakdown[errorKey] = [];
                    }
                    errorBreakdown[errorKey].push(error.error);
                }
            }
        }

        // Get top 10 most used tools
        const topTools = Object.entries(toolUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tool, count]) => ({ tool, count }));

        // Get most common errors (top 5)
        const commonErrors = Object.entries(errorBreakdown)
            .map(([tool, errors]) => ({
                tool,
                count: errors.length,
                sample_error: errors[0]
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Build response
        return {
            success: true,
            analysis: {
                period_days: days,
                filter: filterBy,
                total_interactions: stats.total,
                success_rate: `${(stats.successRate * 100).toFixed(1)}%`,
                avg_iterations: stats.avgIterations.toFixed(2),
                avg_duration_ms: stats.avgDuration ? Math.round(stats.avgDuration) : null,
                model_usage: stats.modelUsage,
                user_satisfaction: {
                    positive: stats.satisfaction.positive,
                    negative: stats.satisfaction.negative,
                    no_reaction: stats.satisfaction.noReaction,
                    positive_rate: stats.total > 0 ? `${((stats.satisfaction.positive / stats.total) * 100).toFixed(1)}%` : '0%'
                },
                top_tools_used: topTools,
                total_tool_executions: totalTools,
                common_errors: commonErrors.length > 0 ? commonErrors : 'No errors in this period'
            }
        };
    } catch (error) {
        console.error('[analyzeOutcomes] Error:', error);
        return {
            success: false,
            error: `Failed to analyze outcomes: ${error.message}`
        };
    }
}

// ===== AGI LEARNING SYSTEM IMPLEMENTATIONS =====

/**
 * Get learning system statistics
 * Provides quick overview of data collection and system health
 * @param {Guild} guild - Discord guild
 * @param {Object} input - Tool input (metric type)
 * @returns {Promise<Object>} Statistics result
 */
async function getLearningStats(guild, input) {
    try {
        const Outcome = require('../models/Outcome');
        const ToolExecution = require('../models/ToolExecution');
        
        const metric = input.metric || 'summary';
        const guildId = guild.id;
        
        // Shared: Get earliest data collection timestamp
        const firstOutcome = await Outcome.findOne({ guildId }).sort({ timestamp: 1 }).lean();
        const dataSince = firstOutcome ? firstOutcome.timestamp : new Date();
        const daysCollecting = Math.floor((Date.now() - dataSince.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (metric) {
            case 'summary': {
                // Total counts
                const totalOutcomes = await Outcome.countDocuments({ guildId });
                const totalToolExecs = await ToolExecution.countDocuments({ guildId });
                
                // Progress to 100 sample minimum (Phase 1 goal)
                const progress = Math.min(100, Math.floor((totalOutcomes / 100) * 100));
                
                return {
                    success: true,
                    summary: `Learning System Health\n` +
                             `Data Points: ${totalOutcomes} outcomes, ${totalToolExecs} tool executions\n` +
                             `Collecting Since: ${daysCollecting} days ago\n` +
                             `Progress: ${progress}% to 100-sample minimum\n` +
                             `Status: ${totalOutcomes >= 100 ? 'Ready for analysis' : 'Collecting data...'}`,
                    stats: {
                        totalOutcomes,
                        totalToolExecs,
                        daysCollecting,
                        progress,
                        ready: totalOutcomes >= 100
                    }
                };
            }
            
            case 'models': {
                // Model selection accuracy and performance
                const modelStats = await Outcome.aggregate([
                    { $match: { guildId } },
                    {
                        $group: {
                            _id: '$modelUsed',
                            count: { $sum: 1 },
                            successRate: {
                                $avg: { $cond: ['$success', 1, 0] }
                            },
                            avgIterations: { $avg: '$iterations' }
                        }
                    },
                    { $sort: { count: -1 } }
                ]);
                
                const modelLines = modelStats.map(m => 
                    `${m._id || 'unknown'}: ${m.count} uses, ` +
                    `${(m.successRate * 100).toFixed(1)}% success, ` +
                    `${m.avgIterations.toFixed(1)} avg iterations`
                ).join('\n');
                
                return {
                    success: true,
                    summary: `Model Performance\n${modelLines || 'No data yet'}`,
                    stats: modelStats
                };
            }
            
            case 'tools': {
                // Top used and failed tools
                const topUsed = await ToolExecution.aggregate([
                    { $match: { guildId } },
                    {
                        $group: {
                            _id: '$toolName',
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
                
                const topFailed = await ToolExecution.aggregate([
                    { $match: { guildId, success: false } },
                    {
                        $group: {
                            _id: '$toolName',
                            failures: { $sum: 1 }
                        }
                    },
                    { $sort: { failures: -1 } },
                    { $limit: 5 }
                ]);
                
                const usedLines = topUsed.map(t => `${t._id}: ${t.count}`).join(', ');
                const failedLines = topFailed.map(t => `${t._id}: ${t.failures}`).join(', ');
                
                return {
                    success: true,
                    summary: `Tool Usage\n` +
                             `Top 10: ${usedLines || 'No data'}\n` +
                             `Failed: ${failedLines || 'None'}`,
                    stats: { topUsed, topFailed }
                };
            }
            
            case 'satisfaction': {
                // User reaction statistics
                const reactionStats = await Outcome.aggregate([
                    { $match: { guildId } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            reacted: {
                                $sum: { $cond: ['$userReacted', 1, 0] }
                            },
                            positive: {
                                $sum: { $cond: [{ $eq: ['$userSatisfaction', 1] }, 1, 0] }
                            },
                            negative: {
                                $sum: { $cond: [{ $eq: ['$userSatisfaction', -1] }, 1, 0] }
                            }
                        }
                    }
                ]);
                
                const stats = reactionStats[0] || { total: 0, reacted: 0, positive: 0, negative: 0 };
                const reactionRate = stats.total > 0 ? (stats.reacted / stats.total * 100).toFixed(1) : 0;
                const ratio = stats.negative > 0 ? (stats.positive / stats.negative).toFixed(1) : stats.positive;
                
                return {
                    success: true,
                    summary: `User Satisfaction\n` +
                             `Reaction Rate: ${reactionRate}% (${stats.reacted}/${stats.total})\n` +
                             `Positive: ${stats.positive}, Negative: ${stats.negative}\n` +
                             `Ratio: ${ratio}:1 (positive:negative)`,
                    stats
                };
            }
            
            default:
                return {
                    success: false,
                    error: `Unknown metric type: ${metric}. Use: summary, models, tools, satisfaction`
                };
        }
    } catch (error) {
        console.error('[getLearningStats] Error:', error);
        return {
            success: false,
            error: `Failed to get learning stats: ${error.message}`
        };
    }
}

/**
 * Review detected patterns - Phase 2
 * Displays patterns with approve/reject buttons for human-in-the-loop validation
 */
async function reviewPatterns(guild, input, message) {
    try {
        const Pattern = require('../models/Pattern');
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const patternType = input.pattern_type || 'all';
        const minConfidence = input.min_confidence || 'medium';
        const guildId = guild.id;
        
        // Get pending patterns using model's static method
        const patterns = await Pattern.getPendingReview(guildId, minConfidence, patternType);
        
        if (patterns.length === 0) {
            return {
                success: true,
                message: `No patterns pending review (filter: ${patternType}, min confidence: ${minConfidence})`
            };
        }
        
        // Get the channel from message
        const channel = message.channel;
        
        // Display each pattern with approve/reject buttons
        for (const pattern of patterns) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_pattern_${pattern._id}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_pattern_${pattern._id}`)
                        .setLabel('❌ Reject')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Format pattern display
            const display = `**Pattern Detected** [${pattern.confidence.toUpperCase()} confidence]
` +
                           `Type: ${pattern.patternType}
` +
                           `Samples: ${pattern.sampleCount} | p-value: ${pattern.statisticalSignificance?.toFixed(4) || 'N/A'}
` +
                           `\n${pattern.description}\n` +
                           `\n**Suggested Action:** ${pattern.suggestedAdjustment}
` +
                           `**Estimated Impact:** ${pattern.estimatedImpact || 'Unknown'}`;
            
            await channel.send({
                content: display,
                components: [row]
            });
        }
        
        // Set up collector for button interactions
        const collector = channel.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith('approve_pattern_') || i.customId.startsWith('reject_pattern_'),
            time: 300000 // 5 minutes
        });
        
        collector.on('collect', async (interaction) => {
            try {
                // CRITICAL: Must respond within 3 seconds (Discord.js requirement)
                await interaction.deferReply({ ephemeral: true });
                
                const [action, , patternId] = interaction.customId.split('_');
                const pattern = await Pattern.findById(patternId);
                
                if (!pattern) {
                    await interaction.editReply({ 
                        content: '❌ Pattern not found. It may have been deleted.' 
                    });
                    return;
                }
                
                if (action === 'approve') {
                    await pattern.approvePattern(interaction.user.id);
                    await interaction.editReply({ 
                        content: `✅ Pattern approved! Will be applied in Phase 3 (Self-Adjustment).\n\nPattern: ${pattern.description}` 
                    });
                } else {
                    await Pattern.findByIdAndDelete(patternId);
                    await interaction.editReply({ 
                        content: `❌ Pattern rejected and deleted.\n\nPattern: ${pattern.description}` 
                    });
                }
                
                // Disable buttons after interaction to prevent duplicate clicks
                await interaction.message.edit({ components: [] });
                
            } catch (error) {
                console.error('[reviewPatterns] Button interaction error:', error);
                try {
                    await interaction.editReply({ 
                        content: `❌ Error processing pattern: ${error.message}` 
                    });
                } catch (e) {
                    // Ignore if reply fails
                }
            }
        });
        
        collector.on('end', () => {
            console.log('[reviewPatterns] Collector ended after 5 minutes');
        });
        
        return {
            success: true,
            message: `Displaying ${patterns.length} pattern(s) for review. Use buttons to approve/reject. You have 5 minutes to respond.`
        };
        
    } catch (error) {
        console.error('[reviewPatterns] Error:', error);
        return {
            success: false,
            error: `Failed to review patterns: ${error.message}`
        };
    }
}

/**
 * Manually trigger pattern analysis - Phase 2
 * Normally runs automatically via weekly cron job
 */
async function runPatternAnalysis(guild, input) {
    try {
        const Outcome = require('../models/Outcome');
        const { runManualAnalysis } = require('../jobs/patternAnalysisJob');
        
        const guildId = guild.id;
        
        // Check minimum sample size
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        const outcomeCount = await Outcome.countDocuments({
            guildId,
            timestamp: { $gte: cutoffDate }
        });
        
        if (outcomeCount < 100) {
            return {
                success: false,
                error: `Insufficient data for pattern analysis. Need 100+ outcomes in last 7 days (currently: ${outcomeCount}).\n` +
                       `Keep using Sunny to collect more data!`
            };
        }
        
        // Trigger manual analysis
        const result = await runManualAnalysis();
        
        if (!result.success) {
            return {
                success: false,
                error: result.message
            };
        }
        
        // Get newly created patterns
        const Pattern = require('../models/Pattern');
        const recentPatterns = await Pattern.find({
            guildId,
            timestamp: { $gte: new Date(Date.now() - 60000) } // Last minute
        }).sort({ confidence: -1 });
        
        if (recentPatterns.length === 0) {
            return {
                success: true,
                message: `Pattern analysis complete. Analyzed ${outcomeCount} outcomes from last 7 days.\n` +
                        `No significant patterns detected (all below threshold).`
            };
        }
        
        const summary = recentPatterns.map(p => 
            `  - [${p.confidence.toUpperCase()}] ${p.patternType}: ${p.description}`
        ).join('\n');
        
        return {
            success: true,
            message: `Pattern analysis complete! Analyzed ${outcomeCount} outcomes.\n` +
                    `\n**Patterns Detected (${recentPatterns.length}):**\n${summary}\n` +
                    `\nUse 'review_patterns' tool to approve/reject these patterns.`
        };
        
    } catch (error) {
        console.error('[runPatternAnalysis] Error:', error);
        return {
            success: false,
            error: `Failed to run pattern analysis: ${error.message}`
        };
    }
}

// ===== PHASE 3: SELF-ADJUSTMENT TOOL IMPLEMENTATIONS =====

/**
 * Propose adjustments from approved patterns
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Proposed adjustments
 */
async function proposeAdjustments(guild, input) {
    try {
        const selfAdjustmentEngine = require('../services/selfAdjustmentEngine');
        const AdjustmentHistory = require('../models/AdjustmentHistory');

        const adjustmentType = input.adjustment_type || 'all';
        const guildId = guild.id;

        // Trigger proposal generation
        const proposalResult = await selfAdjustmentEngine.proposeAdjustments(guildId);

        if (!proposalResult.success) {
            return {
                success: false,
                error: proposalResult.message
            };
        }

        // Get pending approval adjustments
        const filters = { guildId, status: 'pending_approval' };
        if (adjustmentType !== 'all') {
            filters.adjustmentType = adjustmentType;
        }

        const pendingAdjustments = await AdjustmentHistory.find(filters)
            .sort({ confidence: -1, timestamp: -1 })
            .limit(10);

        if (pendingAdjustments.length === 0) {
            return {
                success: true,
                message: `No pending adjustments found (filter: ${adjustmentType}).\n` +
                        `${proposalResult.message || 'System will propose new adjustments when patterns are approved.'}`
            };
        }

        // Format proposals
        const proposals = pendingAdjustments.map((adj, idx) => {
            return `**${idx + 1}. ${adj.adjustmentType.toUpperCase()}** [${adj.confidence.toUpperCase()} confidence]\n` +
                   `   ID: \`${adj._id}\`\n` +
                   `   ${adj.description}\n` +
                   `   Estimated Impact: ${adj.estimatedImpact}\n` +
                   `   Samples: ${adj.sampleCount} | p-value: ${adj.pValue?.toFixed(4) || 'N/A'}\n`;
        }).join('\n');

        return {
            success: true,
            message: `**Pending Adjustment Proposals (${pendingAdjustments.length}):**\n\n${proposals}\n` +
                    `Use 'approve_adjustment' to start canary rollout or 'reject_adjustment' to dismiss.`
        };

    } catch (error) {
        console.error('[proposeAdjustments] Error:', error);
        return {
            success: false,
            error: `Failed to propose adjustments: ${error.message}`
        };
    }
}

/**
 * Approve an adjustment to start canary rollout
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @param {Message} message - Discord message object for button interactions
 * @returns {Promise<Object>} Approval result
 */
async function approveAdjustment(guild, input, message) {
    try {
        const selfAdjustmentEngine = require('../services/selfAdjustmentEngine');
        const AdjustmentHistory = require('../models/AdjustmentHistory');
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const adjustmentId = input.adjustment_id;
        const userId = message.author.id;

        // Get adjustment
        const adjustment = await AdjustmentHistory.findById(adjustmentId);

        if (!adjustment) {
            return {
                success: false,
                error: `Adjustment not found: ${adjustmentId}`
            };
        }

        if (adjustment.status !== 'pending_approval') {
            return {
                success: false,
                error: `Adjustment is not pending approval (current status: ${adjustment.status})`
            };
        }

        // Confirm with button
        const channel = message.channel;
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_approve_${adjustmentId}`)
                    .setLabel('✅ Confirm Approval')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`cancel_approve_${adjustmentId}`)
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await channel.send({
            content: `**Confirm Adjustment Approval**\n\n` +
                    `Type: ${adjustment.adjustmentType}\n` +
                    `${adjustment.description}\n\n` +
                    `This will start a canary rollout at 5% traffic.\n` +
                    `The system will automatically progress to 100% if A/B testing shows improvement.\n` +
                    `Automatic rollback will occur if performance drops >10%.`,
            components: [row]
        });

        // Set up collector
        const collector = channel.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith(`confirm_approve_${adjustmentId}`) ||
                          i.customId.startsWith(`cancel_approve_${adjustmentId}`),
            time: 60000 // 1 minute
        });

        collector.on('collect', async (interaction) => {
            try {
                await interaction.deferReply({ ephemeral: true });

                if (interaction.customId.startsWith('confirm_approve')) {
                    // Apply adjustment
                    const result = await selfAdjustmentEngine.applyAdjustment(adjustmentId, userId);

                    if (result.success) {
                        await interaction.editReply({
                            content: `✅ Adjustment approved and deployed at 5% canary!\n\n` +
                                    `Type: ${adjustment.adjustmentType}\n` +
                                    `${adjustment.description}\n\n` +
                                    `Use 'monitor_adjustments' to track A/B testing progress.`
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ Failed to apply adjustment: ${result.error}`
                        });
                    }
                } else {
                    await interaction.editReply({
                        content: `❌ Approval cancelled.`
                    });
                }

                await confirmMsg.edit({ components: [] });

            } catch (error) {
                console.error('[approveAdjustment] Button interaction error:', error);
                try {
                    await interaction.editReply({
                        content: `❌ Error: ${error.message}`
                    });
                } catch (e) {
                    // Ignore
                }
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await confirmMsg.edit({
                    content: confirmMsg.content + '\n\n⏱️ Confirmation timed out.',
                    components: []
                });
            }
        });

        return {
            success: true,
            message: 'Awaiting confirmation...'
        };

    } catch (error) {
        console.error('[approveAdjustment] Error:', error);
        return {
            success: false,
            error: `Failed to approve adjustment: ${error.message}`
        };
    }
}

/**
 * Reject a proposed adjustment
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Rejection result
 */
async function rejectAdjustment(guild, input) {
    try {
        const AdjustmentHistory = require('../models/AdjustmentHistory');

        const adjustmentId = input.adjustment_id;
        const reason = input.reason || 'No reason provided';

        // Get adjustment
        const adjustment = await AdjustmentHistory.findById(adjustmentId);

        if (!adjustment) {
            return {
                success: false,
                error: `Adjustment not found: ${adjustmentId}`
            };
        }

        if (adjustment.status !== 'pending_approval') {
            return {
                success: false,
                error: `Can only reject pending adjustments (current status: ${adjustment.status})`
            };
        }

        // Reject
        await adjustment.reject(reason);

        return {
            success: true,
            message: `✅ Adjustment rejected.\n\n` +
                    `Type: ${adjustment.adjustmentType}\n` +
                    `${adjustment.description}\n` +
                    `Reason: ${reason}`
        };

    } catch (error) {
        console.error('[rejectAdjustment] Error:', error);
        return {
            success: false,
            error: `Failed to reject adjustment: ${error.message}`
        };
    }
}

/**
 * Monitor active adjustments with A/B testing metrics
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Monitoring results
 */
async function monitorAdjustments(guild, input) {
    try {
        const AdjustmentHistory = require('../models/AdjustmentHistory');

        const rolloutStage = input.rollout_stage || 'all';
        const guildId = guild.id;

        // Get active adjustments
        const filters = { guildId, status: 'active' };
        if (rolloutStage !== 'all') {
            filters.rolloutStage = rolloutStage;
        }

        const activeAdjustments = await AdjustmentHistory.find(filters)
            .sort({ timestamp: -1 });

        if (activeAdjustments.length === 0) {
            return {
                success: true,
                message: `No active adjustments found (filter: ${rolloutStage})`
            };
        }

        // Format monitoring data
        const monitoringData = activeAdjustments.map((adj, idx) => {
            const controlGroup = adj.controlGroup || {};
            const treatmentGroup = adj.treatmentGroup || {};

            const controlRate = (controlGroup.successRate * 100).toFixed(1);
            const treatmentRate = (treatmentGroup.successRate * 100).toFixed(1);
            const improvement = ((treatmentRate - controlRate)).toFixed(1);
            const improvementSymbol = improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️';

            const significance = adj.isSignificant ? '✅ SIGNIFICANT' : '⏳ Testing';
            const pValueStr = adj.pValue ? `p=${adj.pValue.toFixed(4)}` : 'N/A';

            return `**${idx + 1}. ${adj.adjustmentType.toUpperCase()}** [${adj.rolloutStage.replace('_', ' ').toUpperCase()}]\n` +
                   `   ID: \`${adj._id}\`\n` +
                   `   ${adj.description}\n\n` +
                   `   **A/B Testing Metrics:**\n` +
                   `   Control Group:   ${controlGroup.samples || 0} samples | ${controlRate}% success\n` +
                   `   Treatment Group: ${treatmentGroup.samples || 0} samples | ${treatmentRate}% success\n` +
                   `   ${improvementSymbol} Improvement: ${improvement}% | ${significance} (${pValueStr})\n` +
                   `   Rollout Progress: ${adj.rolloutProgress}%\n`;
        }).join('\n');

        return {
            success: true,
            message: `**Active Adjustments (${activeAdjustments.length}):**\n\n${monitoringData}\n` +
                    `System monitors every hour and auto-progresses/rolls back based on performance.`
        };

    } catch (error) {
        console.error('[monitorAdjustments] Error:', error);
        return {
            success: false,
            error: `Failed to monitor adjustments: ${error.message}`
        };
    }
}

/**
 * Manually rollback an active adjustment
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Rollback result
 */
async function rollbackAdjustment(guild, input) {
    try {
        const selfAdjustmentEngine = require('../services/selfAdjustmentEngine');
        const AdjustmentHistory = require('../models/AdjustmentHistory');

        const adjustmentId = input.adjustment_id;
        const reason = input.reason;

        // Get adjustment
        const adjustment = await AdjustmentHistory.findById(adjustmentId);

        if (!adjustment) {
            return {
                success: false,
                error: `Adjustment not found: ${adjustmentId}`
            };
        }

        if (adjustment.status !== 'active') {
            return {
                success: false,
                error: `Can only rollback active adjustments (current status: ${adjustment.status})`
            };
        }

        // Perform rollback
        const result = await selfAdjustmentEngine.rollbackAdjustment(adjustmentId, reason, false);

        if (result.success) {
            return {
                success: true,
                message: `✅ Adjustment rolled back successfully.\n\n` +
                        `Type: ${adjustment.adjustmentType}\n` +
                        `${adjustment.description}\n` +
                        `Reason: ${reason}\n\n` +
                        `Configuration has been reverted to original state.`
            };
        } else {
            return {
                success: false,
                error: result.message
            };
        }

    } catch (error) {
        console.error('[rollbackAdjustment] Error:', error);
        return {
            success: false,
            error: `Failed to rollback adjustment: ${error.message}`
        };
    }
}

/**
 * View adjustment history
 * @param {Guild} guild - Discord guild object
 * @param {Object} input - Tool input parameters
 * @returns {Promise<Object>} Historical adjustments
 */
async function adjustmentHistory(guild, input) {
    try {
        const AdjustmentHistory = require('../models/AdjustmentHistory');

        const days = Math.min(input.days || 30, 365);
        const statusFilter = input.status || 'all';
        const guildId = guild.id;

        // Build filters
        const filters = { guildId };
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        filters.timestamp = { $gte: since };

        if (statusFilter !== 'all') {
            filters.status = statusFilter;
        }

        const history = await AdjustmentHistory.find(filters)
            .sort({ timestamp: -1 })
            .limit(20);

        if (history.length === 0) {
            return {
                success: true,
                message: `No adjustment history found (last ${days} days, filter: ${statusFilter})`
            };
        }

        // Format history
        const historyData = history.map((adj, idx) => {
            const statusEmoji = {
                'completed': '✅',
                'rolled_back': '🔄',
                'failed': '❌',
                'rejected': '🚫',
                'active': '🔧'
            }[adj.status] || '❓';

            const date = adj.timestamp.toISOString().split('T')[0];

            let metrics = '';
            if (adj.status === 'completed' || adj.status === 'rolled_back') {
                const controlRate = ((adj.controlGroup?.successRate || 0) * 100).toFixed(1);
                const treatmentRate = ((adj.treatmentGroup?.successRate || 0) * 100).toFixed(1);
                const improvement = (treatmentRate - controlRate).toFixed(1);
                metrics = `\n   Final Result: ${improvement}% improvement (${adj.isSignificant ? 'significant' : 'not significant'})`;
            }

            return `**${idx + 1}. ${statusEmoji} ${adj.adjustmentType.toUpperCase()}** [${date}]\n` +
                   `   ${adj.description}\n` +
                   `   Status: ${adj.status}${metrics}\n`;
        }).join('\n');

        return {
            success: true,
            message: `**Adjustment History (Last ${days} days):**\n\n${historyData}\n` +
                    `Showing up to 20 most recent adjustments.`
        };

    } catch (error) {
        console.error('[adjustmentHistory] Error:', error);
        return {
            success: false,
            error: `Failed to get adjustment history: ${error.message}`
        };
    }
}

module.exports = { execute };
