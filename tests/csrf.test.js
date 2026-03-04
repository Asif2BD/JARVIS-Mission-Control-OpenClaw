/**
 * CSRF Token Tests (v1.12.0)
 * Tests CSRF token generation and validation using the csrf library.
 */

const Tokens = require('csrf');

describe('CSRF Token Generation & Validation', () => {
    let tokens;

    beforeEach(() => {
        tokens = new Tokens();
    });

    test('generates a secret synchronously', () => {
        const secret = tokens.secretSync();
        expect(secret).toBeTruthy();
        expect(typeof secret).toBe('string');
        expect(secret.length).toBeGreaterThan(10);
    });

    test('creates a token from a secret', () => {
        const secret = tokens.secretSync();
        const token = tokens.create(secret);
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(10);
    });

    test('verifies a valid token against its secret', () => {
        const secret = tokens.secretSync();
        const token = tokens.create(secret);
        expect(tokens.verify(secret, token)).toBe(true);
    });

    test('rejects a token verified against a different secret', () => {
        const secret1 = tokens.secretSync();
        const secret2 = tokens.secretSync();
        const token = tokens.create(secret1);
        expect(tokens.verify(secret2, token)).toBe(false);
    });

    test('rejects a tampered token', () => {
        const secret = tokens.secretSync();
        const token = tokens.create(secret);
        const tampered = token.slice(0, -3) + 'XXX';
        expect(tokens.verify(secret, tampered)).toBe(false);
    });

    test('rejects empty/null tokens', () => {
        const secret = tokens.secretSync();
        expect(tokens.verify(secret, '')).toBe(false);
        expect(tokens.verify(secret, null)).toBe(false);
        expect(tokens.verify(secret, undefined)).toBe(false);
    });

    test('each generated token is unique', () => {
        const secret = tokens.secretSync();
        const t1 = tokens.create(secret);
        const t2 = tokens.create(secret);
        // Tokens are salted so each should be unique
        expect(t1).not.toBe(t2);
        // But both should verify with the same secret
        expect(tokens.verify(secret, t1)).toBe(true);
        expect(tokens.verify(secret, t2)).toBe(true);
    });

    test('generates secret asynchronously', async () => {
        const secret = await tokens.secret();
        expect(secret).toBeTruthy();
        expect(typeof secret).toBe('string');
    });
});
