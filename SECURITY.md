# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | ✅ Active support  |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **hello@digitalchokro.com** with:

1. A description of the vulnerability.
2. Steps to reproduce the issue.
3. The potential impact of the vulnerability.
4. Any suggested fixes (optional).

## Response Timeline

- **Acknowledgment:** Within 24 hours of your report.
- **Initial Assessment:** Within 48 hours.
- **Patch for Critical Issues:** Within 72 hours of confirmed critical vulnerabilities.
- **Public Disclosure:** After a fix is released, we will publish a security advisory.

## Security Architecture

AskChokro implements a 9-layer security model. See `docs/adr/002-ast-over-regex-sql-validation.md` and `docs/adr/003-ast-tenant-scope-rewriter.md` for detailed architectural decisions.

**Important:** AST-based validation and tenant scope rewriting dramatically reduce risk but cannot guarantee full isolation in all edge cases across all SQL dialects. See ADR 003's "Known Limitations" section for honest documentation of the boundaries.

## Scope

This security policy covers:
- The `@askchokro/*` npm packages.
- The AskChokro playground application.
- The AskChokro documentation site.

It does **not** cover:
- Third-party AI provider APIs (OpenAI, Anthropic, etc.).
- The user's database security configuration.
- Third-party database drivers.

## Thank You

We appreciate responsible disclosure. Contributors who report valid security vulnerabilities will be credited in the security advisory (unless they prefer to remain anonymous).
