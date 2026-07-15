/**
 * eval/report-template.ts
 * Generates a self-contained, zero-dependency HTML report from EvalReport data.
 */

export interface EvalResult {
  question: string;
  category: string;
  success: boolean;
  generatedSql: string;
  expectedSql: string;
  error?: string;
  executionMs: number;
  tokenUsage?: { input: number; output: number };
}

export interface CategoryStats {
  total: number;
  success: number;
  latencies: number[];
}

export interface EvalReport {
  providerName: string;
  modelName: string;
  runAt: string;
  total: number;
  successCount: number;
  successRate: number;
  totalTokens: number;
  categories: Record<string, CategoryStats>;
  results: EvalResult[];
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function svgBar(rate: number, color: string): string {
  const pct = Math.round(rate * 100);
  return `
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="120" height="14" viewBox="0 0 120 14">
        <rect x="0" y="2" width="120" height="10" rx="5" fill="#e2e8f0"/>
        <rect x="0" y="2" width="${pct * 1.2}" height="10" rx="5" fill="${color}"/>
      </svg>
      <span style="font-size:0.85rem;font-weight:600;color:${color}">${pct}%</span>
    </div>`;
}

function rateColor(rate: number): string {
  if (rate >= 0.8) return '#22c55e';
  if (rate >= 0.6) return '#f59e0b';
  return '#ef4444';
}

export function generateHtmlReport(report: EvalReport): string {
  const catRows = Object.entries(report.categories).map(([cat, stats]) => {
    const rate = stats.total > 0 ? stats.success / stats.total : 0;
    const med = median(stats.latencies);
    const p = p95(stats.latencies);
    const color = rateColor(rate);
    return `
      <tr>
        <td style="font-weight:600;padding:10px 12px;">${cat}</td>
        <td style="padding:10px 12px;text-align:center;">${stats.success}/${stats.total}</td>
        <td style="padding:10px 12px;">${svgBar(rate, color)}</td>
        <td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:0.85rem;">${med.toFixed(0)}ms</td>
        <td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:0.85rem;">${p.toFixed(0)}ms</td>
      </tr>`;
  }).join('');

  const resultRows = report.results.map(r => {
    const bg = r.success ? '#f0fdf4' : '#fef2f2';
    const badge = r.success
      ? `<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">PASS</span>`
      : `<span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">FAIL</span>`;
    const errRow = r.error ? `<div style="color:#ef4444;font-size:0.8rem;margin-top:4px;">⚠️ ${r.error}</div>` : '';
    return `
      <tr style="background:${bg};">
        <td style="padding:10px 12px;">${badge}</td>
        <td style="padding:10px 12px;font-size:0.85rem;">${r.category}</td>
        <td style="padding:10px 12px;font-size:0.9rem;">${r.question}</td>
        <td style="padding:10px 12px;font-family:monospace;font-size:0.78rem;">
          ${r.generatedSql || '<em style="color:#94a3b8">—</em>'}
          ${errRow}
        </td>
        <td style="padding:10px 12px;font-family:monospace;font-size:0.78rem;color:#64748b;">${r.expectedSql}</td>
        <td style="padding:10px 12px;text-align:right;font-size:0.8rem;">${r.executionMs.toFixed(0)}ms</td>
      </tr>`;
  }).join('');

  const overallColor = rateColor(report.successRate / 100);
  const passThreshold = parseFloat(process.env.EVAL_PASS_THRESHOLD || '70');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AskChokro Eval Report — ${report.runAt}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
    h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 1.1rem; font-weight: 600; margin: 28px 0 12px; color: #475569; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 32px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 24px; margin-bottom: 24px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .stat { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-val { font-size: 2rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .pass-banner { background: #dcfce7; border: 1px solid #86efac; border-radius: 12px; padding: 14px 20px; color: #15803d; font-weight: 600; margin-bottom: 20px; }
    .fail-banner { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 14px 20px; color: #b91c1c; font-weight: 600; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🤖 AskChokro Eval Report</h1>
  <p class="meta">Provider: <strong>${report.providerName}</strong> &nbsp;·&nbsp; Model: <strong>${report.modelName}</strong> &nbsp;·&nbsp; Run at: <strong>${report.runAt}</strong></p>

  ${report.successRate >= passThreshold
    ? `<div class="pass-banner">✅ PASS — Accuracy ${report.successRate.toFixed(1)}% meets the ${passThreshold}% threshold.</div>`
    : `<div class="fail-banner">❌ FAIL — Accuracy ${report.successRate.toFixed(1)}% is below the ${passThreshold}% threshold.</div>`
  }

  <div class="card">
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-val" style="color:${overallColor}">${report.successRate.toFixed(1)}%</div>
        <div class="stat-label">Overall Accuracy</div>
      </div>
      <div class="stat">
        <div class="stat-val">${report.successCount}/${report.total}</div>
        <div class="stat-label">Tests Passed</div>
      </div>
      <div class="stat">
        <div class="stat-val">${median(report.results.map(r => r.executionMs)).toFixed(0)}ms</div>
        <div class="stat-label">Median Latency</div>
      </div>
      <div class="stat">
        <div class="stat-val">${p95(report.results.map(r => r.executionMs)).toFixed(0)}ms</div>
        <div class="stat-label">P95 Latency</div>
      </div>
      <div class="stat">
        <div class="stat-val">${report.totalTokens.toLocaleString()}</div>
        <div class="stat-label">Total Tokens</div>
      </div>
    </div>
  </div>

  <h2>By Category</h2>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:center">Pass/Total</th>
          <th>Accuracy</th>
          <th style="text-align:right">Median</th>
          <th style="text-align:right">P95</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>

  <h2>Individual Results</h2>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th style="width:70px">Result</th>
          <th style="width:160px">Category</th>
          <th>Question</th>
          <th>Generated SQL</th>
          <th>Expected SQL</th>
          <th style="text-align:right">Time</th>
        </tr>
      </thead>
      <tbody>${resultRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}
