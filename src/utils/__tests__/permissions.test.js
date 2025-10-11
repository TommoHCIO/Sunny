// src/utils/__tests__/permissions.test.js
const {
    hasBotPermission,
    getMissingCriticalPermissions,
    canTimeout,
    canBan,
    canKick,
    isOwner,
    requiresOwner,
    checkPermission
} = require('../permissions');
const { PermissionFlagsBits } = require('discord.js');

// Mock Guild object
function createMockGuild(botPermissions = []) {
    return {
        members: {
            me: {
                permissions: {
                    has: jest.fn((perm) => botPermissions.includes(perm))
                }
            }
        }
    };
}

describe('Permissions Utils', () => {
    // Clear environment before each test
    beforeEach(() => {
        delete process.env.DISCORD_OWNER_ID;
    });

    describe('hasBotPermission', () => {
        test('should return true when bot has permission', () => {
            const guild = createMockGuild([PermissionFlagsBits.ModerateMembers]);

            expect(hasBotPermission(guild, 'ModerateMembers')).toBe(true);
        });

        test('should return false when bot lacks permission', () => {
            const guild = createMockGuild([]);

            expect(hasBotPermission(guild, 'ModerateMembers')).toBe(false);
        });

        test('should return false for invalid guild', () => {
            expect(hasBotPermission(null, 'ModerateMembers')).toBe(false);
        });

        test('should return false for unknown permission', () => {
            const guild = createMockGuild([]);
            
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = jest.fn();
            
            expect(hasBotPermission(guild, 'InvalidPermission')).toBe(false);
            
            console.error = originalError;
        });
    });

    describe('getMissingCriticalPermissions', () => {
        test('should return empty array when all permissions granted', () => {
            const guild = createMockGuild([
                PermissionFlagsBits.ModerateMembers,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ViewAuditLog
            ]);

            const missing = getMissingCriticalPermissions(guild);
            expect(missing).toEqual([]);
        });

        test('should return list of missing permissions', () => {
            const guild = createMockGuild([]);

            const missing = getMissingCriticalPermissions(guild);
            
            expect(missing.length).toBe(5);
            expect(missing).toContain('ModerateMembers');
            expect(missing).toContain('ManageRoles');
            expect(missing).toContain('ManageChannels');
            expect(missing).toContain('ManageMessages');
            expect(missing).toContain('ViewAuditLog');
        });

        test('should return partially missing permissions', () => {
            const guild = createMockGuild([
                PermissionFlagsBits.ModerateMembers,
                PermissionFlagsBits.ManageRoles
            ]);

            const missing = getMissingCriticalPermissions(guild);
            
            expect(missing.length).toBe(3);
            expect(missing).toContain('ManageChannels');
            expect(missing).toContain('ManageMessages');
            expect(missing).toContain('ViewAuditLog');
        });
    });

    describe('canTimeout', () => {
        test('should return true when bot has ModerateMembers permission', () => {
            const guild = createMockGuild([PermissionFlagsBits.ModerateMembers]);

            expect(canTimeout(guild)).toBe(true);
        });

        test('should return false when bot lacks ModerateMembers permission', () => {
            const guild = createMockGuild([]);

            expect(canTimeout(guild)).toBe(false);
        });
    });

    describe('canBan', () => {
        test('should return true when bot has BanMembers permission', () => {
            const guild = createMockGuild([PermissionFlagsBits.BanMembers]);

            expect(canBan(guild)).toBe(true);
        });

        test('should return false when bot lacks BanMembers permission', () => {
            const guild = createMockGuild([]);

            expect(canBan(guild)).toBe(false);
        });
    });

    describe('canKick', () => {
        test('should return true when bot has KickMembers permission', () => {
            const guild = createMockGuild([PermissionFlagsBits.KickMembers]);

            expect(canKick(guild)).toBe(true);
        });

        test('should return false when bot lacks KickMembers permission', () => {
            const guild = createMockGuild([]);

            expect(canKick(guild)).toBe(false);
        });
    });

    describe('isOwner', () => {
        test('should return true for valid owner ID', () => {
            process.env.DISCORD_OWNER_ID = '123456789';

            expect(isOwner('123456789')).toBe(true);
        });

        test('should return false for non-owner ID', () => {
            process.env.DISCORD_OWNER_ID = '123456789';

            expect(isOwner('987654321')).toBe(false);
        });

        test('should return false when no owner ID set', () => {
            expect(isOwner('123456789')).toBe(false);
        });

        test('should support multiple owner IDs', () => {
            process.env.DISCORD_OWNER_ID = '123456789, 987654321, 555555555';

            expect(isOwner('123456789')).toBe(true);
            expect(isOwner('987654321')).toBe(true);
            expect(isOwner('555555555')).toBe(true);
            expect(isOwner('111111111')).toBe(false);
        });

        test('should return false for null user ID', () => {
            process.env.DISCORD_OWNER_ID = '123456789';

            // Suppress console.error
            const originalError = console.error;
            console.error = jest.fn();

            expect(isOwner(null)).toBe(false);

            console.error = originalError;
        });
    });

    describe('requiresOwner', () => {
        test('should return true for owner-only commands', () => {
            expect(requiresOwner('create_channel')).toBe(true);
            expect(requiresOwner('delete_channel')).toBe(true);
            expect(requiresOwner('rename_channel')).toBe(true);
            expect(requiresOwner('ban')).toBe(true);
            expect(requiresOwner('unban')).toBe(true);
            expect(requiresOwner('configure_bot')).toBe(true);
            expect(requiresOwner('server_settings')).toBe(true);
        });

        test('should return false for non-owner commands', () => {
            expect(requiresOwner('timeout')).toBe(false);
            expect(requiresOwner('warn')).toBe(false);
            expect(requiresOwner('kick')).toBe(false);
            expect(requiresOwner('send_message')).toBe(false);
        });
    });

    describe('checkPermission', () => {
        test('should allow owner to use owner commands', async () => {
            process.env.DISCORD_OWNER_ID = '123456789';
            
            const mockMessage = {
                author: { id: '123456789' },
                reply: jest.fn()
            };

            const result = await checkPermission(mockMessage, 'ban');

            expect(result).toBe(true);
            expect(mockMessage.reply).not.toHaveBeenCalled();
        });

        test('should deny non-owner from using owner commands', async () => {
            process.env.DISCORD_OWNER_ID = '123456789';
            
            const mockMessage = {
                author: { id: '987654321' },
                reply: jest.fn().mockResolvedValue({})
            };

            const result = await checkPermission(mockMessage, 'ban');

            expect(result).toBe(false);
            expect(mockMessage.reply).toHaveBeenCalled();
        });

        test('should allow anyone to use non-owner commands', async () => {
            process.env.DISCORD_OWNER_ID = '123456789';
            
            const mockMessage = {
                author: { id: '987654321' },
                reply: jest.fn()
            };

            const result = await checkPermission(mockMessage, 'timeout');

            expect(result).toBe(true);
            expect(mockMessage.reply).not.toHaveBeenCalled();
        });
    });
});
