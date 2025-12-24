// src/__tests__/services/idempotency.test.js
/**
 * Tests for Idempotency Service
 */

const idempotencyService = require('../../services/idempotencyService');

describe('IdempotencyService', () => {
    beforeEach(() => {
        idempotencyService.clear();
    });

    afterAll(() => {
        idempotencyService.shutdown();
    });

    describe('generateKey', () => {
        it('should generate consistent keys for same input', () => {
            const key1 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test' },
                'user123',
                'guild456'
            );
            const key2 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test' },
                'user123',
                'guild456'
            );
            expect(key1).toBe(key2);
        });

        it('should generate different keys for different inputs', () => {
            const key1 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test1' },
                'user123',
                'guild456'
            );
            const key2 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test2' },
                'user123',
                'guild456'
            );
            expect(key1).not.toBe(key2);
        });

        it('should generate different keys for different users', () => {
            const key1 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test' },
                'user123',
                'guild456'
            );
            const key2 = idempotencyService.generateKey(
                'create_channel',
                { name: 'test' },
                'user789',
                'guild456'
            );
            expect(key1).not.toBe(key2);
        });
    });

    describe('store and check', () => {
        it('should store and retrieve results', () => {
            const key = 'test-key-1';
            const result = { success: true, data: 'test' };

            idempotencyService.store(key, result);
            const cached = idempotencyService.check(key);

            expect(cached.exists).toBe(true);
            expect(cached.result).toEqual(result);
        });

        it('should return exists: false for unknown keys', () => {
            const cached = idempotencyService.check('unknown-key');
            expect(cached.exists).toBe(false);
        });

        it('should expire entries after TTL', async () => {
            const key = 'expiring-key';
            const result = { success: true };

            idempotencyService.store(key, result, 50); // 50ms TTL

            // Immediately available
            expect(idempotencyService.check(key).exists).toBe(true);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(idempotencyService.check(key).exists).toBe(false);
        });
    });

    describe('executeWithIdempotency', () => {
        it('should execute and cache new operations', async () => {
            let executionCount = 0;
            const executor = async () => {
                executionCount++;
                return { success: true, count: executionCount };
            };

            const result1 = await idempotencyService.executeWithIdempotency(
                'test_tool',
                { input: 'data' },
                'user1',
                'guild1',
                executor
            );

            expect(result1.cached).toBe(false);
            expect(result1.result.success).toBe(true);
            expect(executionCount).toBe(1);
        });

        it('should return cached result for duplicate operations', async () => {
            let executionCount = 0;
            const executor = async () => {
                executionCount++;
                return { success: true, count: executionCount };
            };

            // First execution
            await idempotencyService.executeWithIdempotency(
                'test_tool',
                { input: 'same' },
                'user1',
                'guild1',
                executor
            );

            // Second execution (should be cached)
            const result2 = await idempotencyService.executeWithIdempotency(
                'test_tool',
                { input: 'same' },
                'user1',
                'guild1',
                executor
            );

            expect(result2.cached).toBe(true);
            expect(executionCount).toBe(1); // Only executed once
        });

        it('should force execution when force option is true', async () => {
            let executionCount = 0;
            const executor = async () => {
                executionCount++;
                return { success: true };
            };

            // First execution
            await idempotencyService.executeWithIdempotency(
                'test_tool',
                { input: 'data' },
                'user1',
                'guild1',
                executor
            );

            // Forced second execution
            await idempotencyService.executeWithIdempotency(
                'test_tool',
                { input: 'data' },
                'user1',
                'guild1',
                executor,
                { force: true }
            );

            expect(executionCount).toBe(2);
        });

        it('should not cache failed operations', async () => {
            let executionCount = 0;
            const executor = async () => {
                executionCount++;
                return { success: false, error: 'Failed' };
            };

            await idempotencyService.executeWithIdempotency(
                'failing_tool',
                { input: 'data' },
                'user1',
                'guild1',
                executor
            );

            // Should execute again since failure wasn't cached
            await idempotencyService.executeWithIdempotency(
                'failing_tool',
                { input: 'data' },
                'user1',
                'guild1',
                executor
            );

            expect(executionCount).toBe(2);
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', () => {
            idempotencyService.store('key1', { success: true });
            idempotencyService.store('key2', { success: true });

            const stats = idempotencyService.getStats();

            expect(stats.totalEntries).toBe(2);
            expect(stats.activeEntries).toBe(2);
            expect(stats.maxSize).toBe(10000);
        });
    });

    describe('invalidate', () => {
        it('should remove specific keys', () => {
            idempotencyService.store('key-to-remove', { data: 'test' });
            expect(idempotencyService.check('key-to-remove').exists).toBe(true);

            idempotencyService.invalidate('key-to-remove');
            expect(idempotencyService.check('key-to-remove').exists).toBe(false);
        });
    });
});
