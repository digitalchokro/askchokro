const assert = require('node:assert/strict');
const reportSecurityAudit = require('./report-security-audit.cjs');
const title = '🔒 Security: npm audit found high-severity vulnerabilities';
const context = { repo: { owner: 'example', repo: 'project' }, serverUrl: 'https://github.com', runId: 123 };

async function check(report, issues = []) {
  const calls = [];
  const github = {
    rest: {
      issues: {
        listForRepo: () => {},
        create: async (input) => calls.push({ action: 'create', ...input }),
        update: async (input) => calls.push({ action: 'update', ...input }),
      },
    },
    paginate: async (_method, input) => {
      assert.equal(input.state, 'open');
      assert.equal(input.labels, 'security');
      calls.push({ action: 'list' });
      return issues;
    },
  };
  await reportSecurityAudit({ github, context, report });
  return calls;
}

async function main() {
  for (const report of [null, {}, { error: { code: 'AUDIT_ENDPOINT_UNAVAILABLE' }, metadata: { vulnerabilities: { high: 2, critical: 0 } } }, { metadata: { vulnerabilities: { high: '2', critical: 0 } } }, { metadata: { vulnerabilities: { high: -1, critical: 0 } } }]) {
    await assert.rejects(check(report), /valid vulnerability counts/);
  }
  assert.deepEqual(await check({ metadata: { vulnerabilities: { moderate: 5, high: 0, critical: 0 } } }), []);

  for (const counts of [{ high: 2, critical: 0 }, { high: 0, critical: 1 }]) {
    const calls = await check({ metadata: { vulnerabilities: counts } });
    assert.deepEqual(calls.map((call) => call.action), ['list', 'create']);
    assert.match(calls[1].body, new RegExp(`${counts.critical} critical and ${counts.high} high-severity`));
    assert.match(calls[1].body, /https:\/\/github.com\/example\/project\/actions\/runs\/123/);
  }

  const existing = { number: 55, title, user: { login: 'github-actions[bot]' } };
  const calls = await check({ metadata: { vulnerabilities: { high: 2, critical: 1 } } }, [
    { number: 57, title, user: { login: 'person' } },
    { number: 56, title, user: { login: 'github-actions[bot]' }, pull_request: {} },
    existing,
  ]);
  assert.deepEqual(calls.map((call) => call.action), ['list', 'update']);
  assert.equal(calls[1].issue_number, 55);

  const manualOnly = await check({ metadata: { vulnerabilities: { high: 1, critical: 0 } } }, [{ number: 57, title, user: { login: 'person' } }]);
  assert.deepEqual(manualOnly.map((call) => call.action), ['list', 'create']);
  console.log('Security audit notifications: invalid scans, low-severity scans, real findings, and issue reuse passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
