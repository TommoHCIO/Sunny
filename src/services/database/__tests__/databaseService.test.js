// src/services/database/__tests__/databaseService.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dbService = require('../databaseService');
const { Warning, Conversation, UserPreference, ServerSettings, ReactionRole } = require('../../../models');

describe('DatabaseService', () => {
    let mongoServer;

    // Setup in-memory MongoDB before all tests
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        
        // Service auto-initializes when mongoose connects
    });

    // Clean up after each test
    afterEach(async () => {
        await Warning.deleteMany({});
        await Conversation.deleteMany({});
        await UserPreference.deleteMany({});
        await ServerSettings.deleteMany({});
        await ReactionRole.deleteMany({});
    });

    // Disconnect and cleanup after all tests
    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    describe('Initialization', () => {
        test('should be connected to MongoDB', async () => {
            expect(mongoose.connection.readyState).toBe(1); // 1 = connected
        });
    });

    describe('Warning Operations', () => {
        describe('saveWarning', () => {
            test('should save a warning successfully', async () => {
                const warning = await dbService.saveWarning(
                    'USER123',
                    'SERVER456',
                    'Test warning',
                    'test-moderator'
                );

                expect(warning).toBeDefined();
                expect(warning.userId).toBe('USER123');
                expect(warning.guildId).toBe('SERVER456');
                expect(warning.reason).toBe('Test warning');
                expect(warning.moderator).toBe('test-moderator');
            });

            test('should handle null values gracefully', async () => {
                const warning = await dbService.saveWarning(
                    'USER123',
                    null,
                    'Test warning',
                    null
                );

                expect(warning).toBeNull();
            });
        });

        describe('getWarnings', () => {
            beforeEach(async () => {
                await Warning.create([
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 1', moderator: 'mod1' },
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 2', moderator: 'mod2' },
                    { userId: 'USER789', guildId: 'SERVER456', reason: 'Warning 3', moderator: 'mod1' }
                ]);
            });

            test('should get warnings for a user', async () => {
                const warnings = await dbService.getWarnings('USER123', 'SERVER456');

                expect(warnings).toHaveLength(2);
                expect(warnings[0].userId).toBe('USER123');
                expect(warnings[1].userId).toBe('USER123');
            });

            test('should return empty array for user with no warnings', async () => {
                const warnings = await dbService.getWarnings('NOUSER', 'SERVER456');

                expect(warnings).toHaveLength(0);
            });

            test('should return empty array on error', async () => {
                const warnings = await dbService.getWarnings(null, null);

                expect(warnings).toHaveLength(0);
            });
        });

        describe('getWarningCount', () => {
            beforeEach(async () => {
                await Warning.create([
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 1', moderator: 'mod1' },
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 2', moderator: 'mod2' }
                ]);
            });

            test('should count warnings for a user', async () => {
                const count = await dbService.getWarningCount('USER123', 'SERVER456');

                expect(count).toBe(2);
            });

            test('should return 0 for user with no warnings', async () => {
                const count = await dbService.getWarningCount('NOUSER', 'SERVER456');

                expect(count).toBe(0);
            });
        });

        describe('removeWarning', () => {
            let warningId;

            beforeEach(async () => {
                const warning = await Warning.create({
                    userId: 'USER123',
                    guildId: 'SERVER456',
                    reason: 'Test warning',
                    moderator: 'mod1'
                });
                warningId = warning._id.toString();
            });

            test('should remove a warning successfully', async () => {
                const result = await dbService.removeWarning(warningId);

                expect(result).toBe(true);

                const warnings = await Warning.find({ userId: 'USER123' });
                expect(warnings).toHaveLength(0);
            });

            test('should return false for non-existent warning', async () => {
                const result = await dbService.removeWarning('000000000000000000000000');

                expect(result).toBe(false);
            });
        });

        describe('clearWarnings', () => {
            beforeEach(async () => {
                await Warning.create([
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 1', moderator: 'mod1' },
                    { userId: 'USER123', guildId: 'SERVER456', reason: 'Warning 2', moderator: 'mod2' }
                ]);
            });

            test('should clear all warnings for a user', async () => {
                const count = await dbService.clearWarnings('USER123', 'SERVER456');

                expect(count).toBe(2);

                const warnings = await Warning.find({ userId: 'USER123' });
                expect(warnings).toHaveLength(0);
            });

            test('should return 0 for user with no warnings', async () => {
                const count = await dbService.clearWarnings('NOUSER', 'SERVER456');

                expect(count).toBe(0);
            });
        });
    });

    describe('Conversation Operations', () => {
        describe('saveConversation', () => {
            test('should save a conversation successfully', async () => {
                const conversation = await dbService.saveConversation(
                    'USER123',
                    'CHANNEL456',
                    'SERVER789',
                    [{ role: 'user', content: 'Hello' }]
                );

                expect(conversation).toBeDefined();
                expect(conversation.userId).toBe('USER123');
                expect(conversation.channelId).toBe('CHANNEL456');
                expect(conversation.guildId).toBe('SERVER789');
                expect(conversation.messages).toHaveLength(1);
            });
        });

        describe('getConversation', () => {
            beforeEach(async () => {
                await Conversation.create({
                    userId: 'USER123',
                    channelId: 'CHANNEL456',
                    guildId: 'SERVER789',
                    messages: [{ role: 'user', content: 'Hello' }]
                });
            });

            test('should get conversation for a user', async () => {
                const conversation = await dbService.getConversation('USER123', 'CHANNEL456');

                expect(conversation).toBeDefined();
                expect(conversation.messages).toHaveLength(1);
            });

            test('should return null for non-existent conversation', async () => {
                const conversation = await dbService.getConversation('NOUSER', 'NOCHANNEL');

                expect(conversation).toBeNull();
            });
        });
    });

    describe('UserPreference Operations', () => {
        describe('getUserPreferences', () => {
            beforeEach(async () => {
                await UserPreference.create({
                    userId: 'USER123',
                    guildId: 'SERVER456',
                    preferences: { theme: 'dark', notifications: true }
                });
            });

            test('should get user preferences', async () => {
                const prefs = await dbService.getUserPreferences('USER123', 'SERVER456');

                expect(prefs).toBeDefined();
                expect(prefs.preferences.theme).toBe('dark');
            });

            test('should return null for non-existent preferences', async () => {
                const prefs = await dbService.getUserPreferences('NOUSER', 'SERVER456');

                expect(prefs).toBeNull();
            });
        });

        describe('saveUserPreferences', () => {
            test('should save user preferences', async () => {
                const prefs = await dbService.saveUserPreferences(
                    'USER123',
                    'SERVER456',
                    { theme: 'light', notifications: false }
                );

                expect(prefs).toBeDefined();
                expect(prefs.preferences.theme).toBe('light');
                expect(prefs.preferences.notifications).toBe(false);
            });

            test('should update existing preferences', async () => {
                await UserPreference.create({
                    userId: 'USER123',
                    guildId: 'SERVER456',
                    preferences: { theme: 'dark' }
                });

                const updated = await dbService.saveUserPreferences(
                    'USER123',
                    'SERVER456',
                    { theme: 'light', notifications: true }
                );

                expect(updated.preferences.theme).toBe('light');
                expect(updated.preferences.notifications).toBe(true);
            });
        });
    });

    describe('ServerSettings Operations', () => {
        describe('getServerSettings', () => {
            beforeEach(async () => {
                await ServerSettings.create({
                    guildId: 'SERVER456',
                    settings: { automod: true, welcomeMessage: 'Welcome!' }
                });
            });

            test('should get server settings', async () => {
                const settings = await dbService.getServerSettings('SERVER456');

                expect(settings).toBeDefined();
                expect(settings.settings.automod).toBe(true);
            });

            test('should return null for non-existent settings', async () => {
                const settings = await dbService.getServerSettings('NOSERVER');

                expect(settings).toBeNull();
            });
        });

        describe('saveServerSettings', () => {
            test('should save server settings', async () => {
                const settings = await dbService.saveServerSettings(
                    'SERVER456',
                    { automod: true, welcomeMessage: 'Hello!' }
                );

                expect(settings).toBeDefined();
                expect(settings.settings.automod).toBe(true);
            });

            test('should update existing settings', async () => {
                await ServerSettings.create({
                    guildId: 'SERVER456',
                    settings: { automod: false }
                });

                const updated = await dbService.saveServerSettings(
                    'SERVER456',
                    { automod: true, welcomeMessage: 'New message' }
                );

                expect(updated.settings.automod).toBe(true);
                expect(updated.settings.welcomeMessage).toBe('New message');
            });
        });
    });

    describe('ReactionRole Operations', () => {
        describe('saveReactionRole', () => {
            test('should save a reaction role', async () => {
                const role = await dbService.saveReactionRole(
                    'MSG123',
                    'CHANNEL456',
                    'SERVER789',
                    '✅',
                    'Member'
                );

                expect(role).toBeDefined();
                expect(role.messageId).toBe('MSG123');
                expect(role.emoji).toBe('✅');
                expect(role.roleName).toBe('Member');
            });

            test('should update existing reaction role', async () => {
                await ReactionRole.create({
                    messageId: 'MSG123',
                    channelId: 'CHANNEL456',
                    guildId: 'SERVER789',
                    emoji: '✅',
                    roleName: 'OldRole'
                });

                const updated = await dbService.saveReactionRole(
                    'MSG123',
                    'CHANNEL456',
                    'SERVER789',
                    '✅',
                    'NewRole'
                );

                expect(updated.roleName).toBe('NewRole');

                const count = await ReactionRole.countDocuments({ messageId: 'MSG123' });
                expect(count).toBe(1);
            });
        });

        describe('getReactionRoles', () => {
            beforeEach(async () => {
                await ReactionRole.create([
                    { messageId: 'MSG1', channelId: 'CH1', guildId: 'SERVER1', emoji: '✅', roleName: 'Role1' },
                    { messageId: 'MSG2', channelId: 'CH2', guildId: 'SERVER1', emoji: '🎮', roleName: 'Role2' }
                ]);
            });

            test('should get reaction roles for a guild', async () => {
                const roles = await dbService.getReactionRoles('SERVER1');

                expect(roles).toHaveLength(2);
            });

            test('should return empty array for guild with no roles', async () => {
                const roles = await dbService.getReactionRoles('NOSERVER');

                expect(roles).toHaveLength(0);
            });
        });

        describe('deleteReactionRole', () => {
            beforeEach(async () => {
                await ReactionRole.create({
                    messageId: 'MSG123',
                    channelId: 'CHANNEL456',
                    guildId: 'SERVER789',
                    emoji: '✅',
                    roleName: 'Member'
                });
            });

            test('should delete a reaction role', async () => {
                const result = await dbService.deleteReactionRole('MSG123', '✅');

                expect(result).toBe(true);

                const roles = await ReactionRole.find({ messageId: 'MSG123' });
                expect(roles).toHaveLength(0);
            });

            test('should return false for non-existent role', async () => {
                const result = await dbService.deleteReactionRole('MSG999', '❌');

                expect(result).toBe(false);
            });
        });
    });

    describe('Cleanup Operations', () => {
        describe('runCleanup', () => {
            beforeEach(async () => {
                // Create old data (30+ days ago)
                const oldDate = new Date();
                oldDate.setDate(oldDate.getDate() - 31);

                await Warning.create({
                    userId: 'USER123',
                    guildId: 'SERVER456',
                    reason: 'Old warning',
                    moderator: 'mod1',
                    createdAt: oldDate
                });

                await Conversation.create({
                    userId: 'USER123',
                    channelId: 'CHANNEL456',
                    guildId: 'SERVER789',
                    messages: [],
                    updatedAt: oldDate
                });

                // Create recent data
                await Warning.create({
                    userId: 'USER789',
                    guildId: 'SERVER456',
                    reason: 'Recent warning',
                    moderator: 'mod2'
                });
            });

            test('should clean up old data', async () => {
                const results = await dbService.runCleanup();

                expect(results.warnings).toBeGreaterThan(0);
                expect(results.conversations).toBeGreaterThan(0);

                const remainingWarnings = await Warning.countDocuments();
                expect(remainingWarnings).toBe(1);
            });
        });

        describe('getDatabaseStats', () => {
            beforeEach(async () => {
                await Warning.create({
                    userId: 'USER123',
                    guildId: 'SERVER456',
                    reason: 'Test',
                    moderator: 'mod1'
                });
                await Conversation.create({
                    userId: 'USER123',
                    channelId: 'CHANNEL456',
                    guildId: 'SERVER789',
                    messages: []
                });
            });

            test('should get database statistics', async () => {
                const stats = await dbService.getDatabaseStats();

                expect(stats).toHaveProperty('warnings');
                expect(stats).toHaveProperty('conversations');
                expect(stats).toHaveProperty('preferences');
                expect(stats).toHaveProperty('serverSettings');
                expect(stats).toHaveProperty('reactionRoles');
                expect(stats.warnings).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe('Error Handling (withFallback)', () => {
        test('should return fallback value on error', async () => {
            // Force an error by passing invalid data
            const result = await dbService.saveWarning(null, null, null, null);

            expect(result).toBeNull();
        });

        test('should return fallback array on error', async () => {
            // Force an error by passing invalid guild ID
            const results = await dbService.getWarnings(null, null);

            expect(results).toEqual([]);
        });

        test('should return fallback number on error', async () => {
            const count = await dbService.getWarningCount(null, null);

            expect(count).toBe(0);
        });
    });
});
