// src/tools/serverInspection.js
/**
 * Server Inspection Tools
 * Tools for getting detailed information about the server
 */

const { PermissionFlagsBits } = require('discord.js');
const moderationService = require('../services/moderationService');

/**
 * Tool #94: Get comprehensive server information
 */
async function getServerInfo(guild) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const owner = await guild.fetchOwner();
        
        return {
            success: true,
            server: {
                name: guild.name,
                id: guild.id,
                description: guild.description || 'No description set',
                owner: {
                    username: owner.user.username,
                    id: owner.id,
                    displayName: owner.displayName
                },
                createdAt: guild.createdAt.toISOString(),
                memberCount: guild.memberCount,
                boostLevel: guild.premiumTier,
                boostCount: guild.premiumSubscriptionCount || 0,
                verificationLevel: guild.verificationLevel,
                explicitContentFilter: guild.explicitContentFilter,
                defaultNotifications: guild.defaultMessageNotifications,
                afkTimeout: guild.afkTimeout,
                afkChannel: guild.afkChannel?.name || 'None',
                systemChannel: guild.systemChannel?.name || 'None',
                rulesChannel: guild.rulesChannel?.name || 'None',
                publicUpdatesChannel: guild.publicUpdatesChannel?.name || 'None',
                maxMembers: guild.maxMembers,
                maxVideoChannelUsers: guild.maxVideoChannelUsers,
                features: guild.features
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get server info: ${error.message}`
        };
    }
}

/**
 * Tool #95: Get server settings and configuration
 */
async function getServerSettings(guild) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const verificationLevels = {
            0: 'None',
            1: 'Low - Must have verified email',
            2: 'Medium - Must be registered for 5+ minutes',
            3: 'High - Must be a member for 10+ minutes',
            4: 'Very High - Must have verified phone'
        };

        const explicitFilters = {
            0: 'Disabled',
            1: 'Members without roles',
            2: 'All members'
        };

        return {
            success: true,
            settings: {
                verification: {
                    level: guild.verificationLevel,
                    description: verificationLevels[guild.verificationLevel]
                },
                contentFilter: {
                    level: guild.explicitContentFilter,
                    description: explicitFilters[guild.explicitContentFilter]
                },
                features: {
                    community: guild.features.includes('COMMUNITY'),
                    partnered: guild.features.includes('PARTNERED'),
                    verified: guild.features.includes('VERIFIED'),
                    discoverable: guild.features.includes('DISCOVERABLE'),
                    invitesDisabled: guild.features.includes('INVITES_DISABLED'),
                    animatedIcon: guild.features.includes('ANIMATED_ICON'),
                    banner: guild.features.includes('BANNER'),
                    welcomeScreen: guild.features.includes('WELCOME_SCREEN_ENABLED'),
                    membershipScreening: guild.features.includes('MEMBER_VERIFICATION_GATE_ENABLED'),
                    previewEnabled: guild.features.includes('PREVIEW_ENABLED')
                },
                channels: {
                    total: guild.channels.cache.size,
                    text: guild.channels.cache.filter(c => c.type === 0).size,
                    voice: guild.channels.cache.filter(c => c.type === 2).size,
                    categories: guild.channels.cache.filter(c => c.type === 4).size,
                    announcements: guild.channels.cache.filter(c => c.type === 5).size,
                    stage: guild.channels.cache.filter(c => c.type === 13).size,
                    forum: guild.channels.cache.filter(c => c.type === 15).size
                },
                roles: {
                    total: guild.roles.cache.size,
                    hoisted: guild.roles.cache.filter(r => r.hoist).size,
                    managed: guild.roles.cache.filter(r => r.managed).size
                },
                emojis: {
                    total: guild.emojis.cache.size,
                    static: guild.emojis.cache.filter(e => !e.animated).size,
                    animated: guild.emojis.cache.filter(e => e.animated).size
                },
                stickers: {
                    total: guild.stickers.cache.size
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get server settings: ${error.message}`
        };
    }
}

/**
 * Tool #96: Get Sunny's current permissions in the server
 */
async function getCurrentPermissions(guild) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const botMember = guild.members.me;
        if (!botMember) {
            return { success: false, error: 'Could not find bot member in guild' };
        }

        const permissions = botMember.permissions;
        
        // Define all important permissions
        const permissionChecks = {
            // General
            'ViewChannels': permissions.has(PermissionFlagsBits.ViewChannel),
            'ManageChannels': permissions.has(PermissionFlagsBits.ManageChannels),
            'ManageRoles': permissions.has(PermissionFlagsBits.ManageRoles),
            'ManageGuild': permissions.has(PermissionFlagsBits.ManageGuild),
            'ViewAuditLog': permissions.has(PermissionFlagsBits.ViewAuditLog),
            'ManageWebhooks': permissions.has(PermissionFlagsBits.ManageWebhooks),
            'ManageGuildExpressions': permissions.has(PermissionFlagsBits.ManageGuildExpressions),
            
            // Membership
            'CreateInstantInvite': permissions.has(PermissionFlagsBits.CreateInstantInvite),
            'ChangeNickname': permissions.has(PermissionFlagsBits.ChangeNickname),
            'ManageNicknames': permissions.has(PermissionFlagsBits.ManageNicknames),
            'KickMembers': permissions.has(PermissionFlagsBits.KickMembers),
            'BanMembers': permissions.has(PermissionFlagsBits.BanMembers),
            'ModerateMembers': permissions.has(PermissionFlagsBits.ModerateMembers),
            
            // Text Channels
            'SendMessages': permissions.has(PermissionFlagsBits.SendMessages),
            'SendMessagesInThreads': permissions.has(PermissionFlagsBits.SendMessagesInThreads),
            'CreatePublicThreads': permissions.has(PermissionFlagsBits.CreatePublicThreads),
            'CreatePrivateThreads': permissions.has(PermissionFlagsBits.CreatePrivateThreads),
            'EmbedLinks': permissions.has(PermissionFlagsBits.EmbedLinks),
            'AttachFiles': permissions.has(PermissionFlagsBits.AttachFiles),
            'AddReactions': permissions.has(PermissionFlagsBits.AddReactions),
            'UseExternalEmojis': permissions.has(PermissionFlagsBits.UseExternalEmojis),
            'UseExternalStickers': permissions.has(PermissionFlagsBits.UseExternalStickers),
            'MentionEveryone': permissions.has(PermissionFlagsBits.MentionEveryone),
            'ManageMessages': permissions.has(PermissionFlagsBits.ManageMessages),
            'ManageThreads': permissions.has(PermissionFlagsBits.ManageThreads),
            'ReadMessageHistory': permissions.has(PermissionFlagsBits.ReadMessageHistory),
            'SendTTSMessages': permissions.has(PermissionFlagsBits.SendTTSMessages),
            
            // Voice Channels
            'Connect': permissions.has(PermissionFlagsBits.Connect),
            'Speak': permissions.has(PermissionFlagsBits.Speak),
            'Stream': permissions.has(PermissionFlagsBits.Stream),
            'UseVAD': permissions.has(PermissionFlagsBits.UseVAD),
            'PrioritySpeaker': permissions.has(PermissionFlagsBits.PrioritySpeaker),
            'MuteMembers': permissions.has(PermissionFlagsBits.MuteMembers),
            'DeafenMembers': permissions.has(PermissionFlagsBits.DeafenMembers),
            'MoveMembers': permissions.has(PermissionFlagsBits.MoveMembers),
            
            // Advanced
            'Administrator': permissions.has(PermissionFlagsBits.Administrator),
            'ManageEvents': permissions.has(PermissionFlagsBits.ManageEvents),
            'UseApplicationCommands': permissions.has(PermissionFlagsBits.UseApplicationCommands),
            'RequestToSpeak': permissions.has(PermissionFlagsBits.RequestToSpeak)
        };

        const granted = Object.entries(permissionChecks)
            .filter(([_, has]) => has)
            .map(([perm]) => perm);
            
        const missing = Object.entries(permissionChecks)
            .filter(([_, has]) => !has)
            .map(([perm]) => perm);

        // Check for critical missing permissions
        const criticalPermissions = [
            'ViewChannels',
            'SendMessages',
            'ReadMessageHistory',
            'ModerateMembers',
            'ManageRoles',
            'ManageChannels'
        ];

        const missingCritical = criticalPermissions.filter(p => !permissionChecks[p]);

        return {
            success: true,
            permissions: {
                granted,
                missing,
                missingCritical,
                hasAdministrator: permissionChecks.Administrator,
                grantedCount: granted.length,
                missingCount: missing.length,
                totalChecked: Object.keys(permissionChecks).length
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get permissions: ${error.message}`
        };
    }
}

/**
 * Tool #97: List all server features
 */
async function listServerFeatures(guild) {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        const featureDescriptions = {
            'ANIMATED_BANNER': 'Server has an animated banner',
            'ANIMATED_ICON': 'Server has an animated icon',
            'APPLICATION_COMMAND_PERMISSIONS_V2': 'Uses new command permissions system',
            'AUTO_MODERATION': 'AutoMod is enabled',
            'BANNER': 'Server has a banner',
            'COMMUNITY': 'Community server with discovery features',
            'CREATOR_MONETIZABLE_PROVISIONAL': 'Server can be monetized (provisional)',
            'CREATOR_STORE_PAGE': 'Server has a creator store page',
            'DEVELOPER_SUPPORT_SERVER': 'Official Discord developer support server',
            'DISCOVERABLE': 'Server is discoverable in Server Discovery',
            'FEATURABLE': 'Server can be featured',
            'INVITES_DISABLED': 'Invites are disabled',
            'INVITE_SPLASH': 'Server has a custom invite splash screen',
            'MEMBER_VERIFICATION_GATE_ENABLED': 'Membership screening is enabled',
            'MORE_STICKERS': 'Can use more than 15 custom stickers',
            'NEWS': 'Server has announcement channels',
            'PARTNERED': 'Official Discord partner',
            'PREVIEW_ENABLED': 'Server can be previewed before joining',
            'RAID_ALERTS_DISABLED': 'Raid alerts are disabled',
            'ROLE_ICONS': 'Server can use role icons',
            'ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE': 'Role subscriptions can be purchased',
            'ROLE_SUBSCRIPTIONS_ENABLED': 'Role subscriptions are enabled',
            'TICKETED_EVENTS_ENABLED': 'Ticketed events are enabled',
            'VANITY_URL': 'Server has a vanity URL',
            'VERIFIED': 'Verified server',
            'VIP_REGIONS': 'VIP voice regions',
            'WELCOME_SCREEN_ENABLED': 'Welcome screen is enabled'
        };

        const enabledFeatures = guild.features.map(feature => ({
            name: feature,
            description: featureDescriptions[feature] || 'Unknown feature'
        }));

        return {
            success: true,
            features: {
                enabled: enabledFeatures,
                count: enabledFeatures.length,
                isCommunity: guild.features.includes('COMMUNITY'),
                isPartnered: guild.features.includes('PARTNERED'),
                isVerified: guild.features.includes('VERIFIED'),
                hasAutoMod: guild.features.includes('AUTO_MODERATION'),
                isDiscoverable: guild.features.includes('DISCOVERABLE')
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list features: ${error.message}`
        };
    }
}

/**
 * Tool #98: Get moderation statistics
 */
async function getModerationStats(guild, timeRange = '24h') {
    if (!guild) {
        return { success: false, error: 'Guild not provided' };
    }

    try {
        // Get stats from moderation service
        const stats = moderationService.getStats(guild.id, timeRange);
        
        return {
            success: true,
            stats: {
                timeRange,
                totalWarnings: stats.total_warnings,
                activeTimeouts: stats.active_timeouts,
                usersFlagged: stats.users_flagged,
                note: 'Warning history resets after 30 days. Statistics are from in-memory cache until MongoDB is configured.'
            }
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to get moderation stats: ${error.message}`
        };
    }
}

module.exports = {
    getServerInfo,
    getServerSettings,
    getCurrentPermissions,
    listServerFeatures,
    getModerationStats
};
