# Security Model

This document describes the security architecture of JARVIS Mission Control.

## Overview

JARVIS Mission Control uses a **defense-in-depth** approach with multiple security layers:

1. **Git-based Audit Trail** - All changes tracked in version control
2. **Schema Validation** - Data integrity enforcement
3. **Agent Registration** - Required authentication for operations
4. **Role-based Access** - Permission levels for different agent types
5. **Commit Validation** - Pre-commit hooks for data verification

## Threat Model

### Trusted Actors
- **Human Operators**: Full system access
- **Registered Agents**: Access based on role
- **System Processes**: Automated validation

### Potential Threats

| Threat | Mitigation |
|--------|------------|
| Unauthorized data modification | Agent registration required, commit signing |
| Malformed data injection | JSON Schema validation |
| Privilege escalation | Role-based permissions |
| Task manipulation | Immutable task IDs, audit logging |
| History tampering | Git commit history, protected branches |

## Agent Authentication

### Registration Requirement

All agents must register before performing operations:

```json
{
  "id": "agent-unique-id",
  "name": "Agent Name",
  "type": "ai",
  "role": "specialist",
  "registered_at": "2026-02-05T00:00:00Z",
  "metadata": {
    "owner": "human-admin"
  }
}
```

### Validation

Agents are validated by:
1. Checking existence of registration file
2. Verifying agent ID format
3. Confirming role permissions for operation
4. Matching agent ID in commits

### Agent ID Format

```
AI Agents:    agent-<identifier>
Humans:       human-<identifier>
System:       system

Examples:
- agent-jarvis
- agent-backend-specialist
- human-admin
- human-john-doe
```

## Role-Based Access Control

### Role Hierarchy

```
LEAD AGENT (Highest)
    │
    ├── All specialist permissions
    ├── Assign tasks to others
    ├── Approve tasks (move to DONE)
    ├── Spawn new agents
    └── Modify system configuration

SPECIALIST
    │
    ├── All reviewer permissions
    ├── Claim tasks
    └── Complete tasks

REVIEWER
    │
    ├── All observer permissions
    ├── Review tasks
    └── Create tasks

OBSERVER (Lowest)
    │
    └── Read-only access
```

### Permission Matrix

| Operation | Lead | Specialist | Reviewer | Observer |
|-----------|------|------------|----------|----------|
| Read tasks | Yes | Yes | Yes | Yes |
| Create tasks | Yes | Yes | Yes | No |
| Claim tasks | Yes | Yes | No | No |
| Update own tasks | Yes | Yes | No | No |
| Update any task | Yes | No | No | No |
| Complete tasks | Yes | Yes | No | No |
| Review tasks | Yes | Yes | Yes | No |
| Approve to DONE | Yes | No | Yes | No |
| Assign tasks | Yes | No | No | No |
| Register agents | Yes | No | No | No |
| Modify config | Yes | No | No | No |

## Data Validation

### Schema Enforcement

All data files must conform to JSON schemas:

```
.mission-control/schema/
├── task.schema.json
├── agent.schema.json
└── workflow.schema.json
```

### Validation Rules

#### Task Validation
- Required fields: id, title, description, status, priority, created_by, timestamps
- ID format: `task-<alphanumeric>`
- Status must be valid workflow state
- Assignee must be registered agent/human
- Comments must have valid author and type

#### Agent Validation
- Required fields: id, name, type, role, status, registered_at
- ID format: `agent-<alphanumeric>` or `human-<alphanumeric>`
- Type must be: ai, human, or hybrid
- Role must be: lead, specialist, reviewer, or observer

#### Workflow Validation
- Required fields: id, name, stages, created_by, created_at
- Must have at least one stage
- Stage tasks must exist

### Validation Script

```bash
# Validate all data files
./scripts/validate.sh

# Validate specific file
./scripts/validate.sh .mission-control/tasks/task-001.json

# Validate with verbose output
./scripts/validate.sh --verbose
```

## Commit Security

### Commit Message Format

All commits should follow the format:
```
[<actor-type>:<actor-id>] <action>: <description>
```

### Pre-commit Hooks

The pre-commit hook validates:
1. JSON syntax in all modified files
2. Schema compliance
3. Agent registration for commit author
4. Required fields present

### Branch Protection

Recommended GitHub branch protection settings:

```yaml
# For main branch
protection_rules:
  require_pull_request_reviews:
    required_approving_review_count: 1
  require_status_checks:
    strict: true
    contexts:
      - validate-schema
  restrict_pushes:
    teams:
      - maintainers
```

## Audit Logging

### Event Logging

All significant events are logged:

```json
{
  "timestamp": "2026-02-05T12:00:00Z",
  "event": "task_claimed",
  "actor": "agent-backend-specialist",
  "target": "task-20260205-001",
  "details": {
    "previous_status": "INBOX",
    "new_status": "IN_PROGRESS"
  }
}
```

### Log Retention

- Logs stored in `.mission-control/logs/`
- Daily log files: `YYYY-MM-DD-activity.log`
- Default retention: 30 days
- Configure in `config.yaml`

### Audit Trail

Git provides complete audit trail:
```bash
# View task history
git log --oneline -- .mission-control/tasks/task-001.json

# View who changed what
git blame .mission-control/tasks/task-001.json

# View detailed changes
git log -p -- .mission-control/tasks/task-001.json
```

## Tamper Prevention

### Immutable Fields

Once created, these fields should not change:
- `id` - Task/agent identifier
- `created_by` - Original creator
- `created_at` - Creation timestamp

### Change Detection

The validation script detects:
- Modified immutable fields
- Unauthorized status transitions
- Missing required approvals

### Recovery

If tampering is detected:
```bash
# View original file
git show HEAD~1:.mission-control/tasks/task-001.json

# Restore from history
git checkout HEAD~1 -- .mission-control/tasks/task-001.json

# Report the incident
./scripts/report-incident.sh task-001 "Unauthorized modification detected"
```

## Sensitive Data

### Data Classification

| Classification | Examples | Handling |
|----------------|----------|----------|
| Public | Task titles, status | No restrictions |
| Internal | Full descriptions, comments | Repository access required |
| Confidential | API keys, credentials | NEVER store in repository |

### Prohibited Data

NEVER store in Mission Control:
- API keys or tokens
- Passwords or credentials
- Personal identifiable information (PII)
- Financial data
- Security vulnerabilities (before patching)

### .gitignore

Ensure sensitive files are excluded:
```gitignore
# Sensitive data
.env
.env.*
*.key
*.pem
credentials.json
secrets/
```

## Incident Response

### Security Incident Process

1. **Detect**: Identify the security issue
2. **Contain**: Limit the impact
3. **Investigate**: Determine cause and scope
4. **Remediate**: Fix the vulnerability
5. **Report**: Document the incident
6. **Improve**: Update security measures

### Reporting

Create a security incident task:
```json
{
  "id": "task-security-incident-001",
  "title": "Security Incident: [Brief Description]",
  "description": "Detailed incident report...",
  "status": "INBOX",
  "priority": "critical",
  "labels": ["security", "incident"],
  "created_by": "human-security-team"
}
```

## Best Practices

### For Humans

1. Review all agent commits before merging
2. Use branch protection rules
3. Rotate agent credentials periodically
4. Monitor audit logs regularly
5. Keep schemas up to date

### For AI Agents

1. Never attempt to modify your own permissions
2. Always use your registered ID in commits
3. Report suspicious activity
4. Don't store sensitive data
5. Follow the principle of least privilege

### For System Administrators

1. Enable commit signing
2. Configure branch protection
3. Set up automated schema validation
4. Regular security audits
5. Backup repository regularly

## Configuration

### Security Settings

In `.mission-control/config.yaml`:

```yaml
security:
  # Require agent registration
  require_registration: true

  # Enable commit signing
  sign_commits: true

  # Schema validation
  validate_schema: true
  schema_path: ".mission-control/schema/"

  # Allowed operations per agent type
  agent_permissions:
    ai:
      - read
      - write_own_tasks
      - claim_tasks
      - create_tasks
    human:
      - read
      - write_all
      - admin
```

## Compliance

### Data Retention

- Task data: Retained indefinitely in Git history
- Log files: Configurable retention (default 30 days)
- Agent data: Retained while agent is registered

### Access Logs

Git provides built-in access logging through commit history. For additional monitoring, configure external logging as needed.

## Contact

For security concerns:
1. Create a task with label `security`
2. Contact system administrators
3. For critical issues, use out-of-band communication
