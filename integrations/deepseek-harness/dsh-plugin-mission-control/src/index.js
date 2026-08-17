/**
 * dsh-plugin-mission-control
 *
 * DeepSeek-Harness (dsh) plugin that mirrors harness activity onto a JARVIS
 * Mission Control board. It subscribes to the durable `session/event` stream
 * and forwards task-relevant moments to Mission Control's REST API:
 *
 *   first turn/start of a session → task created (IN_PROGRESS)
 *   turn/start                    → status kept IN_PROGRESS + activity log
 *   user/message                  → activity log excerpt
 *   assistant/message             → activity log excerpt
 *   tool/call, tool/result        → activity log entries
 *   turn/end                      → task moved to REVIEW (never DONE —
 *                                   Mission Control reserves DONE for humans)
 *
 * dsh is a v0.1 developer preview: event names are overridable via config and
 * payloads are read defensively, so upstream renames degrade to config fixes
 * and unknown shapes degrade to log lines instead of crashes.
 */

import { MissionControlClient } from './mc-client.js';

export const name = 'dsh-plugin-mission-control';

export const defaultConfig = {
  missionControlUrl: 'http://localhost:3000',
  agentId: 'agent-dsh',
  agentName: 'DeepSeek Harness',
  designation: 'Harnessed Agent',
  capabilities: ['coding', 'automation'],
  maxExcerpt: 280,
  dryRun: false,
  // Durable session events, per docs/architecture.md of deepseek-harness.
  // Override any of these if a future preview renames them.
  events: {
    channel: 'session/event',
    turnStart: 'turn/start',
    turnEnd: 'turn/end',
    userMessage: 'user/message',
    assistantMessage: 'assistant/message',
    toolCall: 'tool/call',
    toolResult: 'tool/result',
  },
};

export function apply(ctx, userConfig = {}) {
  const config = {
    ...defaultConfig,
    ...userConfig,
    events: { ...defaultConfig.events, ...(userConfig.events || {}) },
  };

  if (!/^[a-zA-Z0-9-_]+$/.test(config.agentId)) {
    throw new Error(`[mission-control] invalid agentId "${config.agentId}" — must match ^[a-zA-Z0-9-_]+$`);
  }

  const log = makeLogger(ctx);
  const client = new MissionControlClient({
    baseUrl: config.missionControlUrl,
    dryRun: config.dryRun,
    log,
  });

  // sessionId → { taskId, turns } for sessions seen while this plugin is loaded
  const sessions = new Map();

  registerAgent(client, config);
  client.sendMessage({
    from: config.agentId,
    to: 'all',
    content: `${config.agentName} connected via dsh-plugin-mission-control.`,
    thread_id: 'chat-general',
    type: 'chat',
  });

  const dispose = ctx.on(config.events.channel, (...args) => {
    try {
      handleEvent(normalizeEvent(args), { client, config, sessions, log });
    } catch (err) {
      // Never let board mirroring break the agent loop.
      log('error', `event handling failed: ${err.message}`);
    }
  });

  // Cordis unwinds ctx.on registrations automatically on unload; the explicit
  // disposer covers hosts that hand one back without auto-unwinding.
  return () => {
    if (typeof dispose === 'function') dispose();
    client.logActivity(config.agentId, 'DISCONNECTED', 'dsh mission-control plugin unloaded');
    client.stop();
  };
}

// ── Event handling ──────────────────────────────────────────────────────────

function handleEvent(evt, { client, config, sessions, log }) {
  if (!evt || !evt.type) return;
  const e = config.events;
  const sessionId = evt.sessionId;

  switch (evt.type) {
    case e.turnStart: {
      const record = ensureTask(sessionId, { client, config, sessions });
      record.turns += 1;
      if (record.turns > 1) {
        client.patchTask(record.taskId, {
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString(),
        });
      }
      client.logActivity(config.agentId, 'TURN_START', `${record.taskId} turn ${record.turns}`);
      break;
    }

    case e.turnEnd: {
      const record = sessions.get(sessionId);
      if (!record) return;
      client.patchTask(record.taskId, {
        status: 'REVIEW',
        updated_at: new Date().toISOString(),
      });
      client.logActivity(config.agentId, 'TURN_END', `${record.taskId} turn ${record.turns} complete, task in REVIEW`);
      client.sendMessage({
        from: config.agentId,
        to: 'all',
        content: `Turn ${record.turns} of ${record.taskId} finished — awaiting review.`,
        thread_id: 'chat-general',
        type: 'chat',
      });
      break;
    }

    case e.userMessage: {
      const record = ensureTask(sessionId, { client, config, sessions });
      client.logActivity('human', 'USER_MESSAGE', `${record.taskId}: ${excerpt(evt, config.maxExcerpt)}`);
      break;
    }

    case e.assistantMessage: {
      const record = ensureTask(sessionId, { client, config, sessions });
      client.logActivity(config.agentId, 'ASSISTANT_MESSAGE', `${record.taskId}: ${excerpt(evt, config.maxExcerpt)}`);
      break;
    }

    case e.toolCall: {
      const record = sessions.get(sessionId);
      const toolName = evt.raw?.tool || evt.raw?.name || 'tool';
      client.logActivity(config.agentId, 'TOOL_CALL', `${record?.taskId || sessionId}: ${toolName}`);
      break;
    }

    case e.toolResult: {
      const record = sessions.get(sessionId);
      const toolName = evt.raw?.tool || evt.raw?.name || 'tool';
      const status = evt.raw?.error ? 'error' : 'ok';
      client.logActivity(config.agentId, 'TOOL_RESULT', `${record?.taskId || sessionId}: ${toolName} → ${status}`);
      break;
    }

    default:
      // step/start, step/end, assistant/chunk, etc. — intentionally ignored.
      break;
  }
}

function ensureTask(sessionId, { client, config, sessions }) {
  let record = sessions.get(sessionId);
  if (record) return record;

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const taskId = `task-${datePart}-dsh-${sanitizeId(sessionId)}`;
  record = { taskId, turns: 0 };
  sessions.set(sessionId, record);

  client.createTask({
    id: taskId,
    title: `dsh session ${sessionId}`,
    description: `Auto-created by dsh-plugin-mission-control for DeepSeek-Harness session "${sessionId}". Follow progress in the activity log.`,
    status: 'IN_PROGRESS',
    priority: 'medium',
    assignee: config.agentId,
    created_by: config.agentId,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    labels: ['dsh', 'auto-created'],
    comments: [],
    deliverables: [],
    dependencies: [],
    blocked_by: [],
  });
  client.logActivity(config.agentId, 'CREATED', `${taskId} for dsh session ${sessionId}`);
  return record;
}

function registerAgent(client, config) {
  const now = new Date().toISOString();
  client.registerAgent({
    id: config.agentId,
    name: config.agentName,
    type: 'ai',
    role: 'specialist',
    designation: config.designation,
    model: 'deepseek-harness',
    status: 'active',
    capabilities: config.capabilities,
    personality: {
      about: 'A DeepSeek-Harness (dsh) agent mirrored onto Mission Control by dsh-plugin-mission-control. Every session I run appears as a task; my turns and tool calls stream into the activity log.',
      tone: 'focused',
      traits: ['harnessed', 'traceable', 'replayable'],
      greeting: 'Harness online. Sessions are being mirrored to the board.',
    },
    registered_at: now,
    last_active: now,
    current_tasks: [],
    completed_tasks: 0,
    metadata: {
      description: 'DeepSeek-Harness bridge agent',
      clearance: 'BETA',
      bridge: 'dsh-plugin-mission-control',
    },
  });
}

// ── Normalization helpers ───────────────────────────────────────────────────

/**
 * The preview docs describe `session/event` but not its exact listener
 * signature. Accept any argument order: the event is whichever object carries
 * a string `type`; the session is whatever else exposes an id.
 */
function normalizeEvent(args) {
  const objs = args.filter((a) => a && typeof a === 'object');
  const event = objs.find((o) => typeof o.type === 'string') || null;
  if (!event) return null;
  const session = objs.find((o) => o !== event && (o.id || o.sessionId)) || null;
  const sessionId = String(
    event.sessionId || event.session?.id || session?.id || session?.sessionId || 'default'
  );
  return { type: event.type, sessionId, raw: event };
}

/** Flatten dsh message content (string or content-part array) to a short excerpt. */
function excerpt(evt, maxLen) {
  const content = evt.raw?.content ?? evt.raw?.text ?? evt.raw?.message?.content ?? '';
  let text;
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join(' ');
  } else {
    text = '';
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '(no text content)';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function sanitizeId(value) {
  const cleaned = String(value).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 24);
  return cleaned || 'session';
}

function makeLogger(ctx) {
  const target = ctx?.logger?.('mission-control');
  return (level, msg) => {
    if (target && typeof target[level] === 'function') target[level](msg);
    else console[level === 'error' ? 'error' : 'log'](`[mission-control] ${msg}`);
  };
}
