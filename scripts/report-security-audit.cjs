const title = '🔒 Security: npm audit found high-severity vulnerabilities';

module.exports = async function reportSecurityAudit({ github, context, report }) {
  const counts = report?.metadata?.vulnerabilities;
  if (report?.error || !counts || ![counts.high, counts.critical].every((count) => Number.isInteger(count) && count >= 0)) {
    throw new Error('Security audit did not return valid vulnerability counts');
  }
  if (counts.high === 0 && counts.critical === 0) return;

  const { owner, repo } = context.repo;
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const body = `The weekly security audit confirmed ${counts.critical} critical and ${counts.high} high-severity findings.

Run \`pnpm audit --audit-level=high\` locally for details, or download the \`security-audit\` artifact.

Workflow run: ${runUrl}`;
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'open', labels: 'security', sort: 'created', direction: 'desc', per_page: 100,
  });
  const existing = issues.find((issue) => !issue.pull_request && issue.title === title && issue.user?.login === 'github-actions[bot]');
  if (existing) {
    await github.rest.issues.update({ owner, repo, issue_number: existing.number, body });
  } else {
    await github.rest.issues.create({ owner, repo, title, body, labels: ['security', 'priority:high'] });
  }
};
