# Resource Management System

## Overview

The Resource Management System provides comprehensive tracking and control of shared resources across agents, including credentials, servers, costs, and quotas.

## Features

### 1. 🔐 Credentials Vault

Secure storage for API keys, tokens, and secrets with AES-256-GCM encryption.

**API Endpoints:**
- `GET /api/credentials` - List all credentials (metadata only)
- `GET /api/credentials/:id?includeValue=true` - Get credential with optional decrypted value
- `POST /api/credentials` - Store new credential
- `DELETE /api/credentials/:id` - Delete credential

**Credential Schema:**
```json
{
  "id": "cred-123",
  "name": "OpenAI API Key",
  "type": "api_key",      // api_key, token, password, certificate, other
  "service": "OpenAI",
  "description": "Production API key",
  "owner": "system",
  "permissions": ["read"],
  "created_at": "2026-02-05T00:00:00.000Z",
  "last_used": "2026-02-05T12:00:00.000Z",
  "usage_count": 42
}
```

**Security:**
- Values encrypted with AES-256-GCM
- Encryption key from `MC_ENCRYPTION_KEY` env var or machine-derived
- Values only decrypted when explicitly requested

### 2. 💻 Resource Registry

Track shared resources like servers, GPUs, and services.

**API Endpoints:**
- `GET /api/resources` - List all resources
- `GET /api/resources/:id` - Get resource details
- `POST /api/resources` - Register new resource
- `GET /api/resources/metrics` - Get resource metrics

**Resource Schema:**
```json
{
  "id": "res-123",
  "name": "GPU Server #1",
  "type": "gpu",          // server, gpu, service, license, other
  "description": "NVIDIA A100 80GB",
  "specs": { "gpu": "A100", "vram": "80GB" },
  "status": "available",
  "cost_per_hour": 2.50,
  "max_booking_hours": 24,
  "owner": "system",
  "tags": ["ml", "training"]
}
```

### 3. 📅 Resource Booking

Reserve resources for specific time slots with conflict detection.

**API Endpoints:**
- `GET /api/bookings` - List bookings (with filters)
- `POST /api/bookings` - Create booking
- `DELETE /api/bookings/:id` - Cancel booking

**Query Parameters:**
- `resource_id` - Filter by resource
- `agent_id` - Filter by agent
- `status` - Filter by status
- `from_date`, `to_date` - Date range

**Booking Schema:**
```json
{
  "id": "book-123",
  "resource_id": "res-123",
  "resource_name": "GPU Server #1",
  "booked_by": "tank",
  "agent_id": "tank",
  "purpose": "Model training",
  "start_time": "2026-02-05T14:00:00.000Z",
  "end_time": "2026-02-05T18:00:00.000Z",
  "status": "confirmed",    // confirmed, cancelled, completed
  "estimated_cost": 10.00,
  "actual_cost": null
}
```

**Features:**
- Automatic conflict detection
- Cost estimation based on resource hourly rate
- WebSocket notifications on booking events

### 4. 💰 Cost Tracking

Track API usage, hosting fees, and other costs per agent.

**API Endpoints:**
- `GET /api/costs` - Get cost summary (with filters)
- `POST /api/costs` - Record cost entry

**Query Parameters:**
- `agent_id` - Filter by agent
- `type` - Filter by cost type
- `from_date`, `to_date` - Date range

**Cost Entry Schema:**
```json
{
  "id": "cost-123",
  "type": "api_usage",    // api_usage, hosting, booking, license, other
  "category": "AI",
  "description": "Anthropic API calls",
  "amount": 12.50,
  "currency": "USD",
  "agent_id": "tank",
  "metadata": { "tokens": 50000 }
}
```

**Cost Summary Response:**
```json
{
  "total": 150.00,
  "by_type": { "api_usage": 100, "hosting": 50 },
  "by_category": { "AI": 100, "Infrastructure": 50 },
  "by_agent": { "tank": 75, "oracle": 75 },
  "items": [...]
}
```

### 5. 📊 Quota Management

Set usage limits with warnings at configurable thresholds and optional hard stops.

**API Endpoints:**
- `GET /api/quotas` - List quotas
- `POST /api/quotas` - Set/update quota
- `PUT /api/quotas/:id/usage` - Update quota usage
- `POST /api/quotas/:id/reset` - Reset quota for new period
- `GET /api/quotas/check` - Check if action is allowed

**Quota Schema:**
```json
{
  "id": "quota-tank-api_calls",
  "agent_id": "tank",     // null for global
  "type": "api_calls",    // api_calls, cost, tokens, storage
  "limit": 1000,
  "period": "monthly",    // daily, weekly, monthly
  "warning_threshold": 0.8,
  "hard_stop": true,
  "current_usage": 750,
  "period_start": "2026-02-01T00:00:00.000Z"
}
```

**Quota Check Response:**
```json
{
  "allowed": true,
  "quota": {...},
  "warning": "Approaching quota limit for api_calls: 85.0%",
  "usage_percent": 0.85
}
```

**Features:**
- Global and per-agent quotas
- Warning at configurable threshold (default 80%)
- Hard stop prevents exceeding limit
- WebSocket notifications for warnings and exceeded quotas

## Dashboard UI

### Resources Section (Right Sidebar)

Quick overview showing:
- Credential count
- Resource count
- Active booking count
- Total costs
- Quota warnings

### Resources Modal

Full management interface with tabs:
1. **Credentials Vault** - Add/view/delete encrypted credentials
2. **Resources** - Register and manage shared resources
3. **Bookings** - Create and manage resource reservations
4. **Costs** - Record and view cost entries
5. **Quotas** - Set and monitor usage quotas

## WebSocket Events

Real-time updates for:
- `credential.created`, `credential.deleted`
- `resource.created`
- `booking.created`, `booking.cancelled`
- `cost.recorded`
- `quota.updated`, `quota.warning`, `quota.exceeded`

## Environment Variables

- `MC_ENCRYPTION_KEY` - 32-byte hex-encoded encryption key for credentials
  - If not set, a machine-derived key is used (suitable for development)
  - **Set this in production for security!**

## Usage Examples

### Store an API Key
```javascript
await MissionControlAPI.createCredential({
  name: 'OpenAI API Key',
  type: 'api_key',
  service: 'OpenAI',
  value: 'sk-...',  // Will be encrypted
  owner: 'system'
});
```

### Book a Resource
```javascript
await MissionControlAPI.createBooking({
  resource_id: 'res-gpu-01',
  agent_id: 'tank',
  start_time: '2026-02-05T14:00:00Z',
  end_time: '2026-02-05T18:00:00Z',
  purpose: 'Model training'
});
```

### Check Quota Before Action
```javascript
const check = await MissionControlAPI.checkQuota('tank', 'api_calls', 100);
if (check.allowed) {
  // Proceed with action
  if (check.warning) {
    console.warn(check.warning);
  }
} else {
  console.error(check.reason);
}
```

### Record Cost
```javascript
await MissionControlAPI.recordCost({
  type: 'api_usage',
  description: 'Claude API calls',
  amount: 5.25,
  agent_id: 'tank',
  category: 'AI'
});
```
