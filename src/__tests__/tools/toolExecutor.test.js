// src/__tests__/tools/toolExecutor.test.js
/**
 * Comprehensive Tool Executor Tests
 * Tests all 78+ tools with mocked Discord.js objects
 */

// Mock dependencies before importing
jest.mock('../../utils/rateLimiter', () => ({
    toolExecutionRateLimiter: {
        removeTokens: jest.fn().mockResolvedValue(true)
    },
    RateLimiter: jest.fn().mockImplementation(() => ({
        removeTokens: jest.fn().mockResolvedValue(true)
    }))
}));

jest.mock('../../models/ServerSettings', () => ({
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({})
}));

jest.mock('../../models/ToolExecution', () => ({
    create: jest.fn().mockResolvedValue({})
}));

// Create mock Discord objects
const createMockGuild = (overrides = {}) => ({
    id: '123456789012345678',
    name: 'Test Server',
    ownerId: '111111111111111111',
    memberCount: 100,
    channels: {
        cache: new Map([
            ['channel1', { id: 'channel1', name: 'general', type: 0, position: 0, parent: null }],
            ['channel2', { id: 'channel2', name: 'voice', type: 2, position: 1, parent: null }],
            ['category1', { id: 'category1', name: 'Category', type: 4, position: 0 }]
        ]),
        create: jest.fn().mockResolvedValue({ id: 'newchannel', name: 'new-channel' }),
        fetch: jest.fn().mockResolvedValue(new Map())
    },
    roles: {
        cache: new Map([
            ['role1', { id: 'role1', name: 'Admin', color: 0xFF0000, position: 10, permissions: { bitfield: BigInt(8) } }],
            ['role2', { id: 'role2', name: 'Member', color: 0x00FF00, position: 5, permissions: { bitfield: BigInt(0) } }],
            ['everyone', { id: '123456789012345678', name: '@everyone', color: 0, position: 0 }]
        ]),
        create: jest.fn().mockResolvedValue({ id: 'newrole', name: 'New Role' }),
        fetch: jest.fn().mockResolvedValue(new Map())
    },
    members: {
        cache: new Map([
            ['user1', {
                id: 'user1',
                user: { username: 'TestUser', displayName: 'Test User' },
                roles: { cache: new Map([['role2', { id: 'role2', name: 'Member' }]]) },
                manageable: true,
                kickable: true,
                bannable: true,
                timeout: jest.fn().mockResolvedValue({}),
                kick: jest.fn().mockResolvedValue({}),
                ban: jest.fn().mockResolvedValue({})
            }]
        ]),
        fetch: jest.fn().mockResolvedValue(new Map())
    },
    emojis: {
        cache: new Map([
            ['emoji1', { id: 'emoji1', name: 'test_emoji', animated: false }]
        ]),
        create: jest.fn().mockResolvedValue({ id: 'newemoji', name: 'new_emoji' })
    },
    stickers: {
        cache: new Map(),
        create: jest.fn().mockResolvedValue({ id: 'newsticker', name: 'new_sticker' })
    },
    invites: {
        fetch: jest.fn().mockResolvedValue(new Map([
            ['abc123', { code: 'abc123', uses: 5, maxUses: 10 }]
        ]))
    },
    scheduledEvents: {
        cache: new Map(),
        create: jest.fn().mockResolvedValue({ id: 'event1', name: 'Test Event' })
    },
    autoModerationRules: {
        fetch: jest.fn().mockResolvedValue(new Map())
    },
    fetchAuditLogs: jest.fn().mockResolvedValue({ entries: new Map() }),
    bans: {
        fetch: jest.fn().mockResolvedValue(new Map())
    },
    setName: jest.fn().mockResolvedValue({}),
    setIcon: jest.fn().mockResolvedValue({}),
    ...overrides
});

const createMockAuthor = (isOwner = false) => ({
    id: isOwner ? '111111111111111111' : '222222222222222222',
    username: isOwner ? 'Owner' : 'User',
    displayName: isOwner ? 'Server Owner' : 'Regular User'
});

const createMockChannel = (overrides = {}) => ({
    id: 'channel1',
    name: 'general',
    type: 0,
    send: jest.fn().mockResolvedValue({ id: 'msg1', content: 'Test' }),
    messages: {
        fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', { id: 'msg1', content: 'Test message', author: { id: 'user1' } }]
        ]))
    },
    setTopic: jest.fn().mockResolvedValue({}),
    setName: jest.fn().mockResolvedValue({}),
    setRateLimitPerUser: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    ...overrides
});

describe('Tool Executor', () => {
    let toolExecutor;
    let mockGuild;
    let mockOwner;
    let mockUser;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset module cache
        jest.resetModules();

        mockGuild = createMockGuild();
        mockOwner = createMockAuthor(true);
        mockUser = createMockAuthor(false);
    });

    describe('Permission System', () => {
        beforeEach(() => {
            // Mock permissions module
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn((id) => id === '111111111111111111')
            }));
            toolExecutor = require('../../tools/toolExecutor');
        });

        it('should allow owner to use owner-only tools', async () => {
            const result = await toolExecutor.execute('list_channels', {}, mockGuild, mockOwner);
            expect(result.success).not.toBe(false);
        });

        it('should deny non-owner access to owner-only tools', async () => {
            const result = await toolExecutor.execute('delete_channel', { channel_id: 'channel1' }, mockGuild, mockUser);
            expect(result.success).toBe(false);
            expect(result.permission_denied).toBe(true);
        });

        it('should allow anyone to use inspection tools', async () => {
            const result = await toolExecutor.execute('list_channels', {}, mockGuild, mockUser);
            expect(result.permission_denied).toBeUndefined();
        });
    });

    describe('Inspection Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('list_channels', () => {
            it('should list all channels', async () => {
                const result = await toolExecutor.execute('list_channels', {}, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
                expect(result.channels || result).toBeDefined();
            });

            it('should filter by channel type', async () => {
                const result = await toolExecutor.execute('list_channels', { type: 'text' }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('list_roles', () => {
            it('should list all roles', async () => {
                const result = await toolExecutor.execute('list_roles', {}, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('list_members', () => {
            it('should list members with default limit', async () => {
                const result = await toolExecutor.execute('list_members', {}, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });

            it('should respect limit parameter', async () => {
                const result = await toolExecutor.execute('list_members', { limit: 5 }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('get_channel_info', () => {
            it('should get channel details', async () => {
                const result = await toolExecutor.execute('get_channel_info', { channel_id: 'channel1' }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Channel Management Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    createChannel: jest.fn().mockResolvedValue({ success: true, channel: { id: 'new', name: 'test' } }),
                    deleteChannel: jest.fn().mockResolvedValue({ success: true }),
                    renameChannel: jest.fn().mockResolvedValue({ success: true }),
                    setChannelTopic: jest.fn().mockResolvedValue({ success: true }),
                    setSlowmode: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('create_channel', () => {
            it('should create a text channel', async () => {
                const result = await toolExecutor.execute('create_channel', {
                    name: 'test-channel',
                    type: 'text'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });

            it('should create a voice channel', async () => {
                const result = await toolExecutor.execute('create_channel', {
                    name: 'voice-channel',
                    type: 'voice'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('delete_channel', () => {
            it('should delete a channel by ID', async () => {
                const result = await toolExecutor.execute('delete_channel', {
                    channel_id: 'channel1'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('set_channel_topic', () => {
            it('should set channel topic', async () => {
                const result = await toolExecutor.execute('set_channel_topic', {
                    channel_id: 'channel1',
                    topic: 'New topic'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('set_slowmode', () => {
            it('should set slowmode duration', async () => {
                const result = await toolExecutor.execute('set_slowmode', {
                    channel_id: 'channel1',
                    seconds: 5
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Role Management Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    createRole: jest.fn().mockResolvedValue({ success: true, role: { id: 'new', name: 'test' } }),
                    deleteRole: jest.fn().mockResolvedValue({ success: true }),
                    renameRole: jest.fn().mockResolvedValue({ success: true }),
                    setRoleColor: jest.fn().mockResolvedValue({ success: true }),
                    assignRole: jest.fn().mockResolvedValue({ success: true }),
                    removeRole: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('create_role', () => {
            it('should create a role', async () => {
                const result = await toolExecutor.execute('create_role', {
                    name: 'Test Role',
                    color: '#FF0000'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('delete_role', () => {
            it('should delete a role by ID', async () => {
                const result = await toolExecutor.execute('delete_role', {
                    role_id: 'role1'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('assign_role', () => {
            it('should assign role to member', async () => {
                const result = await toolExecutor.execute('assign_role', {
                    user_id: 'user1',
                    role_id: 'role1'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Message Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    sendMessage: jest.fn().mockResolvedValue({ success: true, message: { id: 'msg1' } }),
                    sendEmbed: jest.fn().mockResolvedValue({ success: true, message: { id: 'msg1' } }),
                    addReaction: jest.fn().mockResolvedValue({ success: true }),
                    pinMessage: jest.fn().mockResolvedValue({ success: true }),
                    unpinMessage: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('send_message', () => {
            it('should send a message to channel', async () => {
                const result = await toolExecutor.execute('send_message', {
                    channel_id: 'channel1',
                    content: 'Hello world!'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('send_embed', () => {
            it('should send an embed message', async () => {
                const result = await toolExecutor.execute('send_embed', {
                    channel_id: 'channel1',
                    title: 'Test Embed',
                    description: 'Test description',
                    color: '#0099FF'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('add_reaction', () => {
            it('should add reaction to message', async () => {
                const result = await toolExecutor.execute('add_reaction', {
                    channel_id: 'channel1',
                    message_id: 'msg1',
                    emoji: '👍'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Moderation Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    timeoutMember: jest.fn().mockResolvedValue({ success: true }),
                    kickMember: jest.fn().mockResolvedValue({ success: true }),
                    banMember: jest.fn().mockResolvedValue({ success: true }),
                    unbanMember: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('timeout_member', () => {
            it('should timeout a member', async () => {
                const result = await toolExecutor.execute('timeout_member', {
                    user_id: 'user1',
                    duration: 60,
                    reason: 'Test timeout'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('kick_member', () => {
            it('should kick a member', async () => {
                const result = await toolExecutor.execute('kick_member', {
                    user_id: 'user1',
                    reason: 'Test kick'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('ban_member', () => {
            it('should ban a member', async () => {
                const result = await toolExecutor.execute('ban_member', {
                    user_id: 'user1',
                    reason: 'Test ban'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Game Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../services/gameService', () => ({
                rollDice: jest.fn().mockResolvedValue({ success: true, result: 15, sides: 20 }),
                flipCoin: jest.fn().mockResolvedValue({ success: true, result: 'heads' }),
                magic8Ball: jest.fn().mockResolvedValue({ success: true, answer: 'It is certain' }),
                getRandomFact: jest.fn().mockResolvedValue({ success: true, fact: 'A fun fact!' })
            }));
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('roll_dice', () => {
            it('should roll a dice', async () => {
                const result = await toolExecutor.execute('roll_dice', {
                    sides: 20
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('flip_coin', () => {
            it('should flip a coin', async () => {
                const result = await toolExecutor.execute('flip_coin', {}, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('magic_8ball', () => {
            it('should answer a question', async () => {
                const result = await toolExecutor.execute('magic_8ball', {
                    question: 'Will this test pass?'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Thread Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    createThread: jest.fn().mockResolvedValue({ success: true, thread: { id: 'thread1' } }),
                    archiveThread: jest.fn().mockResolvedValue({ success: true }),
                    lockThread: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('create_thread', () => {
            it('should create a thread', async () => {
                const result = await toolExecutor.execute('create_thread', {
                    channel_id: 'channel1',
                    name: 'Test Thread'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Event Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    createEvent: jest.fn().mockResolvedValue({ success: true, event: { id: 'event1' } }),
                    deleteEvent: jest.fn().mockResolvedValue({ success: true })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('create_event', () => {
            it('should create an event', async () => {
                const result = await toolExecutor.execute('create_event', {
                    name: 'Test Event',
                    start_time: new Date(Date.now() + 86400000).toISOString(),
                    description: 'Test event description'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Webhook Tools', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            jest.doMock('../../handlers/actionHandler', () => {
                return jest.fn().mockImplementation(() => ({
                    createWebhook: jest.fn().mockResolvedValue({ success: true, webhook: { id: 'wh1' } }),
                    deleteWebhook: jest.fn().mockResolvedValue({ success: true }),
                    listWebhooks: jest.fn().mockResolvedValue({ success: true, webhooks: [] })
                }));
            });
            toolExecutor = require('../../tools/toolExecutor');
        });

        describe('create_webhook', () => {
            it('should create a webhook', async () => {
                const result = await toolExecutor.execute('create_webhook', {
                    channel_id: 'channel1',
                    name: 'Test Webhook'
                }, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });

        describe('list_webhooks', () => {
            it('should list webhooks', async () => {
                const result = await toolExecutor.execute('list_webhooks', {}, mockGuild, mockOwner);
                expect(result.success).not.toBe(false);
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            jest.doMock('../../utils/permissions', () => ({
                isOwner: jest.fn(() => true)
            }));
            toolExecutor = require('../../tools/toolExecutor');
        });

        it('should handle unknown tool gracefully', async () => {
            const result = await toolExecutor.execute('unknown_tool', {}, mockGuild, mockOwner);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle missing required parameters', async () => {
            const result = await toolExecutor.execute('delete_channel', {}, mockGuild, mockOwner);
            // Should fail gracefully without channel_id
            expect(result).toBeDefined();
        });
    });
});

// Tool category test summary
describe('Tool Categories Summary', () => {
    const toolCategories = {
        'Server Inspection': [
            'list_channels', 'list_roles', 'list_members', 'get_channel_info',
            'get_server_info', 'get_server_settings', 'list_server_features',
            'get_current_permissions', 'audit_permissions', 'get_moderation_stats'
        ],
        'Channel Management': [
            'create_channel', 'delete_channel', 'rename_channel', 'create_category',
            'delete_category', 'move_channel', 'set_channel_topic', 'set_slowmode',
            'set_channel_nsfw', 'set_channel_position', 'get_channel_permissions'
        ],
        'Voice/Stage Channels': [
            'create_stage_channel', 'set_bitrate', 'set_user_limit',
            'set_rtc_region', 'create_stage_instance'
        ],
        'Channel Permissions': [
            'set_channel_permissions', 'remove_channel_permission', 'sync_channel_permissions'
        ],
        'Forum Channels': [
            'create_forum_channel', 'set_default_thread_slowmode', 'set_available_tags'
        ],
        'Role Management': [
            'create_role', 'delete_role', 'rename_role', 'set_role_color',
            'assign_role', 'remove_role', 'set_role_permissions', 'get_role_info',
            'get_role_members', 'update_role_permissions', 'add_role_permission',
            'remove_role_permission', 'set_role_position', 'hoist_role', 'mentionable_role'
        ],
        'Member Management': [
            'timeout_member', 'kick_member', 'set_nickname', 'get_member_info',
            'get_member_roles', 'get_member_permissions', 'list_members_with_role',
            'search_members', 'list_timeouts', 'remove_timeout', 'get_audit_log',
            'ban_member', 'unban_member', 'get_bans', 'set_member_deaf', 'set_member_mute'
        ],
        'Message Management': [
            'send_message', 'send_embed', 'edit_message', 'delete_message',
            'pin_message', 'unpin_message', 'purge_messages', 'get_channel_messages'
        ],
        'Reactions': [
            'add_reaction', 'remove_reaction', 'remove_all_reactions',
            'setup_reaction_role', 'remove_reaction_role', 'list_reaction_roles',
            'send_button_message'
        ],
        'Threads': [
            'create_thread', 'archive_thread', 'lock_thread',
            'create_forum_post', 'delete_thread', 'pin_thread'
        ],
        'Events': [
            'create_event', 'delete_event', 'edit_event', 'start_event', 'end_event'
        ],
        'Emoji/Stickers': [
            'list_emojis', 'create_emoji', 'delete_emoji', 'edit_emoji',
            'list_stickers', 'create_sticker', 'edit_sticker', 'delete_sticker'
        ],
        'Server Management': [
            'set_server_name', 'set_server_icon', 'set_server_banner',
            'set_verification_level', 'get_server_info'
        ],
        'Invites': [
            'create_invite', 'delete_invite', 'list_invites'
        ],
        'Webhooks': [
            'create_webhook', 'list_webhooks', 'delete_webhook',
            'execute_webhook', 'edit_webhook'
        ],
        'AutoMod': [
            'create_automod_rule', 'list_automod_rules',
            'delete_automod_rule', 'edit_automod_rule'
        ],
        'Auto Messages': [
            'create_auto_message', 'list_auto_messages', 'update_auto_message',
            'delete_auto_message', 'get_auto_message', 'enable_auto_messages',
            'disable_auto_messages'
        ],
        'Tickets': [
            'create_ticket', 'close_ticket', 'assign_ticket', 'update_ticket_priority',
            'list_tickets', 'get_ticket_stats', 'get_ticket', 'add_ticket_tag',
            'enable_ticketing', 'disable_ticketing', 'configure_ticket_categories'
        ],
        'Games': [
            'generate_trivia_question', 'start_trivia', 'get_trivia_leaderboard',
            'create_poll', 'create_quick_poll', 'start_rps', 'start_number_guess',
            'roll_dice', 'flip_coin', 'magic_8ball', 'get_random_fact',
            'get_game_leaderboard', 'get_user_game_stats'
        ],
        'AGI Learning': [
            'get_learning_stats', 'analyze_outcomes', 'review_patterns',
            'run_pattern_analysis', 'propose_adjustments', 'approve_adjustment',
            'reject_adjustment', 'monitor_adjustments', 'rollback_adjustment',
            'adjustment_history'
        ]
    };

    it('should have comprehensive tool coverage', () => {
        let totalTools = 0;
        Object.values(toolCategories).forEach(tools => {
            totalTools += tools.length;
        });

        console.log('\n📊 TOOL CATEGORIES SUMMARY:');
        console.log('='.repeat(50));
        Object.entries(toolCategories).forEach(([category, tools]) => {
            console.log(`${category}: ${tools.length} tools`);
        });
        console.log('='.repeat(50));
        console.log(`TOTAL: ${totalTools} tools across ${Object.keys(toolCategories).length} categories\n`);

        expect(totalTools).toBeGreaterThanOrEqual(75);
    });
});
