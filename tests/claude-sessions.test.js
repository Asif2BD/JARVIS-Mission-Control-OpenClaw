/**
 * Claude Session Scanner Tests (v1.12.0)
 * Tests JSONL parsing logic for Claude Code session files.
 */

// ---- Extracted logic from server/claude-sessions.js ----

const MODEL_PRICING = {
    'claude-opus-4':      { input: 15.00, output: 75.00 },
    'claude-sonnet-4':    { input: 3.00,  output: 15.00 },
    'claude-haiku-4':     { input: 0.80,  output: 4.00  },
    default:              { input: 3.00,  output: 15.00 },
};

function getPricing(model) {
    if (!model) return MODEL_PRICING.default;
    for (const key of Object.keys(MODEL_PRICING)) {
        if (key !== 'default' && model.startsWith(key)) return MODEL_PRICING[key];
    }
    return MODEL_PRICING.default;
}

function estimateCost(model, inputTokens, outputTokens) {
    const pricing = getPricing(model);
    return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Parse JSONL session content (mirrors server/claude-sessions.js parseSessionFile logic).
 */
function parseSessionContent(rawContent, sessionId = 'test-session') {
    const lines = rawContent.trim().split('\n').filter(Boolean);
    let firstTimestamp = null;
    let lastTimestamp = null;
    let messageCount = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    let model = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const line of lines) {
        let entry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue; // skip malformed
        }

        if (!entry.timestamp) continue;

        const ts = new Date(entry.timestamp).getTime();
        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;

        if (entry.type === 'user') {
            userMessages++;
            messageCount++;
        }

        if (entry.type === 'assistant') {
            assistantMessages++;
            messageCount++;
            if (!model && entry.message && entry.message.model) {
                model = entry.message.model;
            }
            if (entry.message && entry.message.usage) {
                const u = entry.message.usage;
                totalInputTokens += (u.input_tokens || 0);
                totalOutputTokens += (u.output_tokens || 0);
            }
        }
    }

    return {
        sessionId,
        model,
        messageCount,
        userMessages,
        assistantMessages,
        totalInputTokens,
        totalOutputTokens,
        estimatedCost: estimateCost(model, totalInputTokens, totalOutputTokens),
        firstTimestamp,
        lastTimestamp,
    };
}

// ---- Test data ----

const SAMPLE_SESSION_JSONL = [
    JSON.stringify({ type: 'user', timestamp: '2026-03-01T10:00:00Z', message: { role: 'user', content: 'Hello' } }),
    JSON.stringify({ type: 'assistant', timestamp: '2026-03-01T10:00:05Z', message: { model: 'claude-sonnet-4-6', role: 'assistant', content: 'Hi!', usage: { input_tokens: 100, output_tokens: 50 } } }),
    JSON.stringify({ type: 'user', timestamp: '2026-03-01T10:01:00Z', message: { role: 'user', content: 'How are you?' } }),
    JSON.stringify({ type: 'assistant', timestamp: '2026-03-01T10:01:10Z', message: { model: 'claude-sonnet-4-6', role: 'assistant', content: "I'm fine!", usage: { input_tokens: 200, output_tokens: 100 } } }),
].join('\n');

const MALFORMED_JSONL = [
    'not valid json',
    JSON.stringify({ type: 'user', timestamp: '2026-03-01T10:00:00Z' }),
    '{ broken',
    JSON.stringify({ type: 'assistant', timestamp: '2026-03-01T10:00:05Z', message: { model: 'claude-haiku-4', usage: { input_tokens: 50, output_tokens: 25 } } }),
].join('\n');

// ---- Tests ----

describe('Claude Session JSONL Parsing', () => {
    test('parses correct message counts', () => {
        const result = parseSessionContent(SAMPLE_SESSION_JSONL);
        expect(result.messageCount).toBe(4);
        expect(result.userMessages).toBe(2);
        expect(result.assistantMessages).toBe(2);
    });

    test('extracts model from assistant messages', () => {
        const result = parseSessionContent(SAMPLE_SESSION_JSONL);
        expect(result.model).toBe('claude-sonnet-4-6');
    });

    test('sums token usage from all assistant messages', () => {
        const result = parseSessionContent(SAMPLE_SESSION_JSONL);
        expect(result.totalInputTokens).toBe(300);
        expect(result.totalOutputTokens).toBe(150);
    });

    test('calculates estimated cost', () => {
        const result = parseSessionContent(SAMPLE_SESSION_JSONL);
        expect(result.estimatedCost).toBeGreaterThan(0);
        // Sonnet: (300/1M) * 3 + (150/1M) * 15 = 0.0009 + 0.00225 = 0.00315
        expect(result.estimatedCost).toBeCloseTo(0.00315, 5);
    });

    test('tracks first and last timestamps', () => {
        const result = parseSessionContent(SAMPLE_SESSION_JSONL);
        expect(result.firstTimestamp).toBe(new Date('2026-03-01T10:00:00Z').getTime());
        expect(result.lastTimestamp).toBe(new Date('2026-03-01T10:01:10Z').getTime());
    });

    test('skips malformed JSON lines gracefully', () => {
        const result = parseSessionContent(MALFORMED_JSONL);
        // Only valid lines (user + assistant) parsed
        expect(result.userMessages).toBe(1);
        expect(result.assistantMessages).toBe(1);
        expect(result.model).toBe('claude-haiku-4');
    });

    test('returns zero cost for empty session', () => {
        const result = parseSessionContent('');
        expect(result.estimatedCost).toBe(0);
        expect(result.messageCount).toBe(0);
    });

    test('skips entries without timestamp', () => {
        const noTimestamp = JSON.stringify({ type: 'user', message: 'no timestamp' });
        const result = parseSessionContent(noTimestamp);
        expect(result.messageCount).toBe(0);
    });
});

describe('Model Pricing', () => {
    test('returns correct price for claude-sonnet-4', () => {
        const pricing = getPricing('claude-sonnet-4-6');
        expect(pricing.input).toBe(3.00);
        expect(pricing.output).toBe(15.00);
    });

    test('returns correct price for claude-haiku-4', () => {
        const pricing = getPricing('claude-haiku-4');
        expect(pricing.input).toBe(0.80);
        expect(pricing.output).toBe(4.00);
    });

    test('returns default price for unknown model', () => {
        const pricing = getPricing('claude-unknown-model');
        expect(pricing).toEqual(MODEL_PRICING.default);
    });

    test('returns default price for null model', () => {
        const pricing = getPricing(null);
        expect(pricing).toEqual(MODEL_PRICING.default);
    });
});
