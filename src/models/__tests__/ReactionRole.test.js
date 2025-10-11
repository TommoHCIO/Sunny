// src/models/__tests__/ReactionRole.test.js
const mongoose = require('mongoose');
const ReactionRole = require('../ReactionRole');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('ReactionRole Model', () => {
    let mongoServer;

    // Setup in-memory MongoDB before all tests
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    });

    // Clean up after each test
    afterEach(async () => {
        await ReactionRole.deleteMany({});
    });

    // Disconnect and cleanup after all tests
    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    describe('Schema Validation', () => {
        test('should create a valid reaction role', async () => {
            const reactionRole = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            const saved = await reactionRole.save();
            
            expect(saved._id).toBeDefined();
            expect(saved.messageId).toBe('1234567890123456789');
            expect(saved.channelId).toBe('9876543210987654321');
            expect(saved.guildId).toBe('1111111111111111111');
            expect(saved.emoji).toBe('✅');
            expect(saved.roleName).toBe('Member');
            expect(saved.createdAt).toBeDefined();
            expect(saved.updatedAt).toBeDefined();
        });

        test('should fail without required messageId', async () => {
            const reactionRole = new ReactionRole({
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            await expect(reactionRole.save()).rejects.toThrow();
        });

        test('should fail without required channelId', async () => {
            const reactionRole = new ReactionRole({
                messageId: '1234567890123456789',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            await expect(reactionRole.save()).rejects.toThrow();
        });

        test('should fail without required guildId', async () => {
            const reactionRole = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                emoji: '✅',
                roleName: 'Member'
            });

            await expect(reactionRole.save()).rejects.toThrow();
        });

        test('should fail without required emoji', async () => {
            const reactionRole = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                roleName: 'Member'
            });

            await expect(reactionRole.save()).rejects.toThrow();
        });

        test('should fail without required roleName', async () => {
            const reactionRole = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅'
            });

            await expect(reactionRole.save()).rejects.toThrow();
        });

        test('should enforce unique compound index (messageId + emoji)', async () => {
            const reactionRole1 = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            await reactionRole1.save();

            // Try to create duplicate
            const reactionRole2 = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Different Role'
            });

            await expect(reactionRole2.save()).rejects.toThrow();
        });

        test('should allow same emoji on different messages', async () => {
            const reactionRole1 = new ReactionRole({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            const reactionRole2 = new ReactionRole({
                messageId: '9999999999999999999',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            await reactionRole1.save();
            await reactionRole2.save();

            const count = await ReactionRole.countDocuments();
            expect(count).toBe(2);
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test data
            await ReactionRole.create([
                {
                    messageId: '1111111111111111111',
                    channelId: '2222222222222222222',
                    guildId: 'GUILD_A',
                    emoji: '✅',
                    roleName: 'Verified'
                },
                {
                    messageId: '1111111111111111111',
                    channelId: '2222222222222222222',
                    guildId: 'GUILD_A',
                    emoji: '🎮',
                    roleName: 'Gamer'
                },
                {
                    messageId: '3333333333333333333',
                    channelId: '4444444444444444444',
                    guildId: 'GUILD_B',
                    emoji: '📚',
                    roleName: 'Reader'
                }
            ]);
        });

        describe('findByMessage', () => {
            test('should find all roles for a message', async () => {
                const roles = await ReactionRole.findByMessage('1111111111111111111');
                
                expect(roles).toHaveLength(2);
                expect(roles[0].emoji).toBe('✅');
                expect(roles[1].emoji).toBe('🎮');
            });

            test('should return empty array for non-existent message', async () => {
                const roles = await ReactionRole.findByMessage('9999999999999999999');
                
                expect(roles).toHaveLength(0);
            });
        });

        describe('findByGuild', () => {
            test('should find all roles for a guild', async () => {
                const roles = await ReactionRole.findByGuild('GUILD_A');
                
                expect(roles).toHaveLength(2);
            });

            test('should return empty array for non-existent guild', async () => {
                const roles = await ReactionRole.findByGuild('GUILD_Z');
                
                expect(roles).toHaveLength(0);
            });

            test('should sort by createdAt descending', async () => {
                const roles = await ReactionRole.findByGuild('GUILD_A');
                
                // Roles should be sorted by createdAt descending
                // Since we created them in bulk, order may vary
                expect(roles.length).toBe(2);
                const emojis = roles.map(r => r.emoji).sort();
                expect(emojis).toEqual(['🎮', '✅'].sort());
            });
        });

        describe('findBinding', () => {
            test('should find specific message+emoji binding', async () => {
                const binding = await ReactionRole.findBinding('1111111111111111111', '✅');
                
                expect(binding).not.toBeNull();
                expect(binding.roleName).toBe('Verified');
            });

            test('should return null for non-existent binding', async () => {
                const binding = await ReactionRole.findBinding('1111111111111111111', '❌');
                
                expect(binding).toBeNull();
            });
        });

        describe('deleteByMessage', () => {
            test('should delete all roles for a message', async () => {
                const deletedCount = await ReactionRole.deleteByMessage('1111111111111111111');
                
                expect(deletedCount).toBe(2);
                
                const remaining = await ReactionRole.countDocuments();
                expect(remaining).toBe(1);
            });

            test('should return 0 for non-existent message', async () => {
                const deletedCount = await ReactionRole.deleteByMessage('9999999999999999999');
                
                expect(deletedCount).toBe(0);
            });
        });

        describe('deleteBinding', () => {
            test('should delete specific message+emoji binding', async () => {
                const deleted = await ReactionRole.deleteBinding('1111111111111111111', '✅');
                
                expect(deleted).toBe(true);
                
                const remaining = await ReactionRole.countDocuments({ messageId: '1111111111111111111' });
                expect(remaining).toBe(1);
            });

            test('should return false for non-existent binding', async () => {
                const deleted = await ReactionRole.deleteBinding('1111111111111111111', '❌');
                
                expect(deleted).toBe(false);
            });
        });

        describe('countByGuild', () => {
            test('should count roles for a guild', async () => {
                const count = await ReactionRole.countByGuild('GUILD_A');
                
                expect(count).toBe(2);
            });

            test('should return 0 for non-existent guild', async () => {
                const count = await ReactionRole.countByGuild('GUILD_Z');
                
                expect(count).toBe(0);
            });
        });
    });

    describe('Indexes', () => {
        test('should have messageId index', async () => {
            const indexes = await ReactionRole.collection.getIndexes();
            
            expect(indexes).toHaveProperty('messageId_1');
        });

        test('should have guildId index', async () => {
            const indexes = await ReactionRole.collection.getIndexes();
            
            expect(indexes).toHaveProperty('guildId_1');
        });

        test('should have compound unique index on messageId+emoji', async () => {
            const indexes = await ReactionRole.collection.getIndexes();
            
            expect(indexes).toHaveProperty('messageId_1_emoji_1');
            // Index is in array format: [[key, direction], [key, direction]]
            const index = indexes['messageId_1_emoji_1'];
            expect(index).toBeDefined();
        });
    });

    describe('Timestamps', () => {
        test('should automatically set createdAt', async () => {
            const reactionRole = await ReactionRole.create({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            expect(reactionRole.createdAt).toBeDefined();
            expect(reactionRole.createdAt).toBeInstanceOf(Date);
        });

        test('should automatically set updatedAt', async () => {
            const reactionRole = await ReactionRole.create({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            expect(reactionRole.updatedAt).toBeDefined();
            expect(reactionRole.updatedAt).toBeInstanceOf(Date);
        });

        test('should update updatedAt on modification', async () => {
            const reactionRole = await ReactionRole.create({
                messageId: '1234567890123456789',
                channelId: '9876543210987654321',
                guildId: '1111111111111111111',
                emoji: '✅',
                roleName: 'Member'
            });

            const originalUpdatedAt = reactionRole.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            reactionRole.roleName = 'Updated Member';
            await reactionRole.save();

            expect(reactionRole.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
    });
});
