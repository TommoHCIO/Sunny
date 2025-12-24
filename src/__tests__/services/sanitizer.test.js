// src/__tests__/services/sanitizer.test.js
/**
 * Tests for the Sanitizer utility
 */

const {
    sanitizeString,
    sanitizeObject,
    containsSensitiveData,
    sanitizeMessageContent
} = require('../../utils/sanitizer');

describe('Sanitizer', () => {
    describe('sanitizeString', () => {
        it('should redact API keys', () => {
            const input = 'My key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456';
            const result = sanitizeString(input);
            expect(result).toBe('My key is [ANTHROPIC_KEY]');
        });

        it('should redact Discord tokens', () => {
            // Using a clearly fake token pattern that matches Discord format
            // Format: base64(user_id).timestamp.hmac
            const fakeToken = 'MTEST' + 'FAKE'.repeat(5) + '.XXXXXX.' + 'y'.repeat(27);
            const input = 'Token: ' + fakeToken;
            const result = sanitizeString(input);
            expect(result).toBe('Token: [DISCORD_TOKEN]');
        });

        it('should redact MongoDB URIs', () => {
            const input = 'mongodb+srv://user:password123@cluster.mongodb.net/db';
            const result = sanitizeString(input);
            expect(result).toBe('[MONGODB_URI]');
        });

        it('should redact password fields', () => {
            const input = 'password: "mysecretpassword123"';
            const result = sanitizeString(input);
            expect(result).toBe('[CREDENTIAL_REDACTED]');
        });

        it('should redact JWT tokens', () => {
            const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
            const result = sanitizeString(input);
            expect(result).toContain('[JWT_TOKEN]');
        });

        it('should handle non-sensitive strings', () => {
            const input = 'Hello, this is a normal message!';
            const result = sanitizeString(input);
            expect(result).toBe('Hello, this is a normal message!');
        });

        it('should handle empty strings', () => {
            expect(sanitizeString('')).toBe('');
        });

        it('should handle non-string inputs', () => {
            expect(sanitizeString(123)).toBe(123);
            expect(sanitizeString(null)).toBe(null);
            expect(sanitizeString(undefined)).toBe(undefined);
        });
    });

    describe('sanitizeObject', () => {
        it('should redact sensitive fields', () => {
            const input = {
                username: 'john',
                password: 'secret123',
                token: 'abc123'
            };
            const result = sanitizeObject(input);
            expect(result.username).toBe('john');
            expect(result.password).toBe('[REDACTED]');
            expect(result.token).toBe('[REDACTED]');
        });

        it('should sanitize nested objects', () => {
            const input = {
                user: {
                    name: 'john',
                    credentials: {
                        password: 'secret'
                    }
                }
            };
            const result = sanitizeObject(input);
            expect(result.user.name).toBe('john');
            expect(result.user.credentials.password).toBe('[REDACTED]');
        });

        it('should sanitize arrays', () => {
            const input = ['normal', 'sk-ant-api03-secretkey12345678901234567890'];
            const result = sanitizeObject(input);
            expect(result[0]).toBe('normal');
            expect(result[1]).toBe('[ANTHROPIC_KEY]');
        });

        it('should handle max depth', () => {
            const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: 'value' } } } } } } } } } } };
            const result = sanitizeObject(deep, 0, 5);
            expect(result.a.b.c.d.e.f).toBe('[MAX_DEPTH_EXCEEDED]');
        });
    });

    describe('containsSensitiveData', () => {
        it('should detect API keys', () => {
            expect(containsSensitiveData('sk-ant-api03-test123456789012345678')).toBe(true);
        });

        it('should detect MongoDB URIs', () => {
            expect(containsSensitiveData('mongodb://user:pass@host/db')).toBe(true);
        });

        it('should return false for safe strings', () => {
            expect(containsSensitiveData('Hello world')).toBe(false);
        });

        it('should handle non-strings', () => {
            expect(containsSensitiveData(123)).toBe(false);
            expect(containsSensitiveData(null)).toBe(false);
        });
    });

    describe('sanitizeMessageContent', () => {
        it('should sanitize and truncate long messages', () => {
            const longMessage = 'a'.repeat(3000);
            const result = sanitizeMessageContent(longMessage);
            expect(result.length).toBeLessThanOrEqual(2015); // 2000 + "... [TRUNCATED]"
            expect(result).toContain('[TRUNCATED]');
        });

        it('should sanitize sensitive data in messages', () => {
            const input = 'Here is my password: secret123456';
            const result = sanitizeMessageContent(input);
            expect(result).not.toContain('secret123456');
        });
    });
});
