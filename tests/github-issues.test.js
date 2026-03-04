/**
 * GitHub Issues Sync Tests (v1.12.0)
 * Tests task card creation from GitHub issues (mock API).
 */

// ---- Extracted logic from server/index.js GitHub sync ----

function issueToTaskCard(issue, repo) {
    const taskId = `task-github-${repo.replace('/', '-')}-issue-${issue.number}`;
    return {
        id: taskId,
        title: issue.title,
        description: `GitHub Issue #${issue.number}: ${issue.html_url}\n\n${issue.body || ''}`.trim(),
        status: 'INBOX',
        priority: issue.labels.some(l => ['urgent', 'critical', 'P0', 'priority:high'].includes(l.name.toLowerCase())) ? 'high' : 'medium',
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        created_by: 'github-sync',
        labels: ['github', ...issue.labels.map(l => l.name).slice(0, 5)],
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_repo: repo,
    };
}

function filterNewIssues(issues, existingTasks) {
    const syncedNums = new Set(
        existingTasks
            .filter(Boolean)
            .map(t => t.github_issue_number)
            .filter(Boolean)
    );
    return issues.filter(issue => !syncedNums.has(issue.number));
}

// ---- Mock data ----

const MOCK_ISSUES = [
    {
        number: 101,
        title: 'Fix dashboard crash on empty task list',
        html_url: 'https://github.com/org/repo/issues/101',
        body: 'When there are no tasks, the dashboard shows a white screen.',
        state: 'open',
        created_at: '2026-03-01T08:00:00Z',
        updated_at: '2026-03-01T09:00:00Z',
        labels: [{ name: 'bug' }, { name: 'urgent' }],
    },
    {
        number: 102,
        title: 'Add dark mode toggle',
        html_url: 'https://github.com/org/repo/issues/102',
        body: 'Users want a dark mode option.',
        state: 'open',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:30:00Z',
        labels: [{ name: 'enhancement' }],
    },
    {
        number: 103,
        title: 'Performance: slow task loading',
        html_url: 'https://github.com/org/repo/issues/103',
        body: null,
        state: 'open',
        created_at: '2026-03-02T08:00:00Z',
        updated_at: '2026-03-02T08:30:00Z',
        labels: [],
    },
];

const REPO = 'org/repo';

// ---- Tests ----

describe('GitHub Issues → Task Card Conversion', () => {
    test('creates task card with correct ID format', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.id).toBe('task-github-org-repo-issue-101');
    });

    test('sets task title from issue title', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.title).toBe('Fix dashboard crash on empty task list');
    });

    test('initial status is INBOX', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.status).toBe('INBOX');
    });

    test('sets priority=high for urgent labels', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.priority).toBe('high');
    });

    test('sets priority=medium for normal labels', () => {
        const card = issueToTaskCard(MOCK_ISSUES[1], REPO);
        expect(card.priority).toBe('medium');
    });

    test('includes github label in labels array', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.labels).toContain('github');
        expect(card.labels).toContain('bug');
        expect(card.labels).toContain('urgent');
    });

    test('stores issue number and URL', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.github_issue_number).toBe(101);
        expect(card.github_issue_url).toBe('https://github.com/org/repo/issues/101');
    });

    test('handles issue with null body', () => {
        const card = issueToTaskCard(MOCK_ISSUES[2], REPO);
        expect(card.description).toBeTruthy();
        expect(card.description).not.toContain('null');
    });

    test('created_by is github-sync', () => {
        const card = issueToTaskCard(MOCK_ISSUES[0], REPO);
        expect(card.created_by).toBe('github-sync');
    });
});

describe('GitHub Issues Sync — Deduplication', () => {
    test('filters out already-synced issues', () => {
        const existingTasks = [
            { github_issue_number: 101 },
            { github_issue_number: 102 },
        ];
        const newIssues = filterNewIssues(MOCK_ISSUES, existingTasks);
        expect(newIssues).toHaveLength(1);
        expect(newIssues[0].number).toBe(103);
    });

    test('returns all issues when no existing tasks', () => {
        const newIssues = filterNewIssues(MOCK_ISSUES, []);
        expect(newIssues).toHaveLength(3);
    });

    test('handles null/undefined tasks in existing list', () => {
        const existingTasks = [null, undefined, { github_issue_number: 101 }];
        const newIssues = filterNewIssues(MOCK_ISSUES, existingTasks);
        expect(newIssues).toHaveLength(2);
    });

    test('returns empty array when all issues already synced', () => {
        const existingTasks = MOCK_ISSUES.map(i => ({ github_issue_number: i.number }));
        const newIssues = filterNewIssues(MOCK_ISSUES, existingTasks);
        expect(newIssues).toHaveLength(0);
    });
});
