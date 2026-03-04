/**
 * Webhook Retry + Circuit Breaker Tests (v1.12.0)
 * Tests retry logic with mock fetch and circuit breaker behavior.
 */

// ---- Inline extracted logic (mirrors server/index.js) ----
// These are pure functions extracted from server/index.js for testability.

const RETRY_DELAYS = [1000, 5000, 30000];
const MAX_CONSECUTIVE_FAILURES = 5;
const CIRCUIT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated triggerWebhooks logic for testing.
 * Returns { success, attempts, circuitState, failures }
 */
async function simulateTriggerWebhook(webhook, mockFetch) {
    const now = Date.now();

    // Circuit breaker check
    if (webhook.circuitState === 'open') {
        const elapsed = now - (webhook.circuitOpenedAt || 0);
        if (elapsed < CIRCUIT_OPEN_DURATION_MS) {
            return { skipped: true, reason: 'circuit_open' };
        }
        webhook.circuitState = 'half-open';
    }

    let success = false;
    let lastError = null;
    let attempts = 0;

    const maxAttempts = RETRY_DELAYS.length + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        attempts++;
        if (attempt > 0) {
            // We don't actually sleep in tests — just track the delay
            webhook.lastRetryDelay = RETRY_DELAYS[attempt - 1];
        }
        try {
            await mockFetch(webhook.url);
            success = true;
            break;
        } catch (err) {
            lastError = err;
        }
    }

    if (success) {
        webhook.failures = 0;
        webhook.successCount = (webhook.successCount || 0) + 1;
        webhook.circuitState = 'closed';
        webhook.circuitOpenedAt = null;
    } else {
        webhook.failures = (webhook.failures || 0) + 1;
        if (webhook.circuitState === 'half-open' || webhook.failures >= MAX_CONSECUTIVE_FAILURES) {
            webhook.circuitState = 'open';
            webhook.circuitOpenedAt = now;
        }
    }

    return { success, attempts, circuitState: webhook.circuitState, failures: webhook.failures };
}

// ---- Tests ----

describe('Webhook Retry Logic', () => {
    test('succeeds on first attempt — no retries', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        const webhook = { url: 'https://example.com', circuitState: 'closed', failures: 0 };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(1);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('retries on failure — up to 4 attempts (1 + 3 retries)', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const webhook = { url: 'https://bad.example.com', circuitState: 'closed', failures: 0 };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(false);
        expect(result.attempts).toBe(4); // initial + 3 retries
        expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    test('succeeds on retry after initial failure', async () => {
        let callCount = 0;
        const mockFetch = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount < 3) throw new Error('Temp error');
            return Promise.resolve({ ok: true });
        });
        const webhook = { url: 'https://flaky.example.com', circuitState: 'closed', failures: 0 };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
    });

    test('uses correct retry delays [1000, 5000, 30000]', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('fail'));
        const webhook = { url: 'https://x.com', circuitState: 'closed', failures: 0 };
        await simulateTriggerWebhook(webhook, mockFetch);
        // Last retry delay is 30000 (3rd retry)
        expect(webhook.lastRetryDelay).toBe(30000);
    });

    test('failure increments webhook.failures', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('fail'));
        const webhook = { url: 'https://x.com', circuitState: 'closed', failures: 2 };
        await simulateTriggerWebhook(webhook, mockFetch);
        expect(webhook.failures).toBe(3);
    });

    test('success resets failure count', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        const webhook = { url: 'https://ok.com', circuitState: 'closed', failures: 3 };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(true);
        expect(webhook.failures).toBe(0);
    });
});

describe('Circuit Breaker', () => {
    test('opens circuit after 5 consecutive failures', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('fail'));
        const webhook = { url: 'https://bad.com', circuitState: 'closed', failures: 0 };
        
        // 5 consecutive failures needed to open circuit
        // Each call increments failures by 1
        for (let i = 0; i < 5; i++) {
            await simulateTriggerWebhook(webhook, mockFetch);
        }
        expect(webhook.circuitState).toBe('open');
        expect(webhook.failures).toBeGreaterThanOrEqual(MAX_CONSECUTIVE_FAILURES);
    });

    test('skips delivery when circuit is open', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        const webhook = {
            url: 'https://bad.com',
            circuitState: 'open',
            circuitOpenedAt: Date.now() - 1000, // opened 1 second ago
            failures: 5,
        };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('circuit_open');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('transitions to half-open after circuit open duration', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        const webhook = {
            url: 'https://recovering.com',
            circuitState: 'open',
            // Set circuitOpenedAt to 6 minutes ago (past the 5-min threshold)
            circuitOpenedAt: Date.now() - (6 * 60 * 1000),
            failures: 5,
        };
        // Should try again (half-open probe)
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(true);
        expect(webhook.circuitState).toBe('closed');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('closes circuit on successful delivery', async () => {
        const mockFetch = jest.fn().mockResolvedValue({ ok: true });
        const webhook = { url: 'https://ok.com', circuitState: 'closed', failures: 4 };
        const result = await simulateTriggerWebhook(webhook, mockFetch);
        expect(result.success).toBe(true);
        expect(webhook.circuitState).toBe('closed');
        expect(webhook.failures).toBe(0);
    });
});
