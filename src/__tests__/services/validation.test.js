// src/__tests__/services/validation.test.js
/**
 * Tests for Zod validation schemas
 */

const { validateToolInput, hasSchema } = require('../../tools/schemas');

describe('Tool Validation Schemas', () => {
    describe('Channel Schemas', () => {
        it('should validate create_channel with valid input', () => {
            const result = validateToolInput('create_channel', {
                channel_name: 'test-channel',
                channel_type: 'text'
            });
            expect(result.success).toBe(true);
            expect(result.data.channel_name).toBe('test-channel');
        });

        it('should reject invalid channel names', () => {
            const result = validateToolInput('create_channel', {
                channel_name: 'Invalid Channel Name!',
                channel_type: 'text'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('channel_name');
        });

        it('should reject empty channel names', () => {
            const result = validateToolInput('create_channel', {
                channel_name: '',
                channel_type: 'text'
            });
            expect(result.success).toBe(false);
        });

        it('should validate set_slowmode with valid input', () => {
            const result = validateToolInput('set_slowmode', {
                channel_name: 'general',
                seconds: 60
            });
            expect(result.success).toBe(true);
        });

        it('should reject slowmode over 6 hours', () => {
            const result = validateToolInput('set_slowmode', {
                channel_name: 'general',
                seconds: 30000 // Over 21600
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Role Schemas', () => {
        it('should validate create_role with valid input', () => {
            const result = validateToolInput('create_role', {
                role_name: 'Moderator',
                color: '#FF5733'
            });
            expect(result.success).toBe(true);
            expect(result.data.color).toBe('#FF5733');
        });

        it('should transform color without hash', () => {
            const result = validateToolInput('create_role', {
                role_name: 'Admin',
                color: 'FF5733'
            });
            expect(result.success).toBe(true);
            expect(result.data.color).toBe('#FF5733');
        });

        it('should reject invalid hex colors', () => {
            const result = validateToolInput('set_role_color', {
                role_name: 'Admin',
                color: 'not-a-color'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Member Schemas', () => {
        it('should validate timeout_member with duration number', () => {
            const result = validateToolInput('timeout_member', {
                username: 'troublemaker',
                duration: 3600
            });
            expect(result.success).toBe(true);
        });

        it('should validate timeout_member with duration string', () => {
            const result = validateToolInput('timeout_member', {
                username: 'troublemaker',
                duration: '5m'
            });
            expect(result.success).toBe(true);
            expect(result.data.duration).toBe(300); // 5 minutes in seconds
        });

        it('should validate kick_member', () => {
            const result = validateToolInput('kick_member', {
                username: 'baduser',
                reason: 'Spamming'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('Message Schemas', () => {
        it('should validate send_message', () => {
            const result = validateToolInput('send_message', {
                channel_name: 'general',
                content: 'Hello, world!'
            });
            expect(result.success).toBe(true);
        });

        it('should reject messages over 2000 chars', () => {
            const result = validateToolInput('send_message', {
                channel_name: 'general',
                content: 'a'.repeat(2001)
            });
            expect(result.success).toBe(false);
        });

        it('should validate send_embed requiring title or description', () => {
            const result = validateToolInput('send_embed', {
                channel_name: 'announcements'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('title or description');
        });

        it('should validate send_embed with title', () => {
            const result = validateToolInput('send_embed', {
                channel_name: 'announcements',
                title: 'Important Announcement'
            });
            expect(result.success).toBe(true);
        });

        it('should validate purge_messages count limit', () => {
            const result = validateToolInput('purge_messages', {
                channel_name: 'spam',
                count: 150
            });
            expect(result.success).toBe(false);
        });
    });

    describe('Game Schemas', () => {
        it('should validate create_poll', () => {
            const result = validateToolInput('create_poll', {
                question: 'What should we play?',
                options: ['Game A', 'Game B', 'Game C']
            });
            expect(result.success).toBe(true);
        });

        it('should reject poll with less than 2 options', () => {
            const result = validateToolInput('create_poll', {
                question: 'Yes?',
                options: ['Yes']
            });
            expect(result.success).toBe(false);
        });

        it('should validate roll_dice', () => {
            const result = validateToolInput('roll_dice', {
                sides: 20,
                count: 3
            });
            expect(result.success).toBe(true);
        });
    });

    describe('Schema Helpers', () => {
        it('should correctly identify tools with schemas', () => {
            expect(hasSchema('create_channel')).toBe(true);
            expect(hasSchema('send_message')).toBe(true);
        });

        it('should return false for unknown tools', () => {
            expect(hasSchema('unknown_tool')).toBe(false);
        });

        it('should allow passthrough for unknown tools', () => {
            const result = validateToolInput('unknown_tool', { any: 'data' });
            expect(result.success).toBe(true);
        });
    });
});
