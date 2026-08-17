const basicAuth = require('../server/middleware/basic-auth');

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
  };
}

describe('basic auth middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MC_AUTH_USER: 'architect', MC_AUTH_PASS: 'secret', MC_AGENT_TOKEN: 'agent-token' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('rejects an unauthenticated remote request', () => {
    const req = { path: '/', headers: {}, socket: { remoteAddress: '203.0.113.10' } };
    const res = makeResponse();
    const next = jest.fn();

    basicAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Basic');
  });

  test('accepts valid basic credentials', () => {
    const encoded = Buffer.from('architect:secret').toString('base64');
    const req = { path: '/', headers: { authorization: `Basic ${encoded}` }, socket: { remoteAddress: '203.0.113.10' } };
    const res = makeResponse();
    const next = jest.fn();

    basicAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('accepts the agent bearer token only for API routes', () => {
    const req = { path: '/api/tasks', headers: { authorization: 'Bearer agent-token' }, socket: { remoteAddress: '203.0.113.10' } };
    const res = makeResponse();
    const next = jest.fn();

    basicAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('allows a direct localhost peer without credentials', () => {
    const req = { path: '/', headers: { 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
    const res = makeResponse();
    const next = jest.fn();

    basicAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('does not trust a spoofed forwarded localhost address', () => {
    const req = { path: '/', headers: { 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '203.0.113.10' } };
    const res = makeResponse();
    const next = jest.fn();

    basicAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
