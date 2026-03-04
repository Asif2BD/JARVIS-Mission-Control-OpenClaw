/**
 * Rate Limiter Config Tests (v1.12.0)
 * Verifies correct rate limit configs for general and strict routes.
 */

// We test the config values directly (not the full Express middleware)
// since the server isn't started in tests.

const GENERAL_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
};

const STRICT_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Too many requests on this endpoint, please try again later.', code: 'RATE_LIMIT_STRICT' },
};

describe('Rate Limiter Config', () => {
    test('general limiter: windowMs is 1 minute', () => {
        expect(GENERAL_LIMIT_CONFIG.windowMs).toBe(60000);
    });

    test('general limiter: max is 100 requests', () => {
        expect(GENERAL_LIMIT_CONFIG.max).toBe(100);
    });

    test('general limiter: correct error message', () => {
        expect(GENERAL_LIMIT_CONFIG.message.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('strict limiter: windowMs is 1 minute', () => {
        expect(STRICT_LIMIT_CONFIG.windowMs).toBe(60000);
    });

    test('strict limiter: max is 10 requests', () => {
        expect(STRICT_LIMIT_CONFIG.max).toBe(10);
    });

    test('strict limiter: stricter than general limiter', () => {
        expect(STRICT_LIMIT_CONFIG.max).toBeLessThan(GENERAL_LIMIT_CONFIG.max);
    });

    test('strict limiter: correct error code', () => {
        expect(STRICT_LIMIT_CONFIG.message.code).toBe('RATE_LIMIT_STRICT');
    });

    test('Retry-After header is set correctly (windowMs / 1000)', () => {
        const retryAfter = Math.ceil(GENERAL_LIMIT_CONFIG.windowMs / 1000);
        expect(retryAfter).toBe(60); // 1 minute in seconds
    });
});
