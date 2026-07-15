# Test Coverage Roadmap

## Current Status

**Overall Coverage:** ~80% (12 packages with tests, 159 tests passing)

| Package | Priority | Status | Tests |
|---------|----------|--------|-------|
| core | CRITICAL | ✅ 29 tests | SQL validation, injection prevention, tenant rewriting, type system |
| adapter-express | HIGH | ✅ 10 tests | Middleware validation, error mapping, custom handlers |
| adapter-nextjs | HIGH | ✅ 7 tests | App Router, NextResponse, JSON body parsing |
| db-postgres | HIGH | ✅ 9 tests | Pool mock, information_schema introspection |
| db-sqlite | HIGH | ✅ 13 tests | In-memory integration, schema, DML, FK detection |
| db-mysql | MEDIUM | ✅ 8 tests | mysql2/promise mock, schema introspection |
| provider-openai | HIGH | ✅ 20 tests | Initialization, messages, errors, token counting |
| provider-ollama | HIGH | ✅ 6 tests | Fetch mock, request body validation |
| provider-anthropic | MEDIUM | ✅ 5 tests | generateSQL, formatResponse |
| provider-gemini | HIGH | ✅ 6 tests | SQL tag parsing, chart format extraction |
| askchokro | CRITICAL | ✅ 18 tests | Auto-discovery, delegation, error forwarding |
| vector-memory | MEDIUM | ❌ No tests | Vector operations, similarity search untested |
| cli | ✅ COMPLETE | ✅ 2 tests | Help text, --help flag validated |
| microservice | LOW | ✅ 8 tests | Supertest: /health, JWT auth, tenant config |

## Implementation Plan

### Phase 1: Critical Foundation (Week 1-2)

#### 1. packages/core - Unit Tests

**Priority:** CRITICAL (blocks all other tests)

**Test Coverage Needed:**
- SQLValidator interface and implementation
- SQL generation pipeline
- Request/response types
- Error handling (AskChokroError)
- Pipeline execution flow

**Suggested Structure:**
```typescript
src/__tests__/
  ├── core.test.ts          // Main pipeline
  ├── validator.test.ts     // SQL validation
  ├── types.test.ts         // Type inference
  └── error.test.ts         // Error handling
```

#### 2. packages/askchokro - Engine Tests

**Priority:** CRITICAL (main package)

**Test Coverage Needed:**
- AskChokro class initialization
- Question → SQL generation flow
- Response formatting
- Database adapter integration
- AI provider integration

### Phase 2: Adapters (Week 3-4)

#### 3. packages/db-sqlite - Integration Tests

**Priority:** HIGH (simplest DB adapter, no external service needed)

**Test Coverage Needed:**
- File creation/management
- Schema reading
- Query execution
- Error handling (missing tables, syntax errors)

**Suggested Structure:**
```typescript
src/__tests__/
  ├── adapter.test.ts       // Adapter interface
  ├── sqlite.test.ts        // SQLite-specific
  └── integration.test.ts   // End-to-end
```

**Setup:**
```typescript
// Test uses temporary file:
const dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
```

#### 4. packages/adapter-express - Middleware Tests

**Priority:** HIGH (web framework integration)

**Test Coverage Needed:**
- Route registration
- Request parsing
- Response formatting
- Error handling
- Query parameter validation

**Suggested Structure:**
```typescript
src/__tests__/
  ├── middleware.test.ts    // Express integration
  ├── routes.test.ts        // Route handlers
  └── errors.test.ts        // Error responses
```

**Setup:**
```typescript
import request from 'supertest';
import express from 'express';
// Mock AskChokro instance
```

### Phase 3: Providers (Week 5-6)

#### 5. packages/provider-openai - Unit Tests

**Priority:** HIGH (most popular AI provider)

**Test Coverage Needed:**
- API client initialization
- Message formatting
- Response parsing
- Error handling (rate limits, API errors)
- Token counting

**Suggested Structure:**
```typescript
src/__tests__/
  ├── provider.test.ts      // Provider interface
  ├── openai.test.ts        // OpenAI-specific
  └── messages.test.ts      // Message formatting
```

**Setup:** Use mocked `openai` SDK with jest.mock()

#### 6. packages/provider-ollama - Unit Tests

**Priority:** HIGH (local-first provider)

**Test Coverage Needed:**
- Connection handling
- Streaming response parsing
- Model availability checking
- Error handling
- Custom endpoint support

### Phase 4: Good First Issues (Week 7-8)

#### 7. packages/db-mysql - Integration Tests

**Priority:** MEDIUM (flagged as good-first-issue)

**Test Coverage Needed:**
- Connection pooling
- Query execution
- Schema introspection
- Error handling (connection refused, auth failed)

**Suggested Structure:**
```typescript
src/__tests__/
  ├── adapter.test.ts       // Adapter interface
  ├── mysql.test.ts         // MySQL-specific
  └── integration.test.ts   // Docker-based
```

**Setup:** Docker container for CI
```yaml
# .github/workflows/test.yml
services:
  mysql:
    image: mysql:8
    env:
      MYSQL_ROOT_PASSWORD: root
```

#### 8. packages/db-postgres - Integration Tests

**Priority:** HIGH

**Similar Structure to MySQL**

### Phase 5: Completeness (Week 9-10)

#### 9. packages/provider-gemini, provider-anthropic - Tests

**Priority:** MEDIUM

#### 10. packages/adapter-nextjs - Tests

**Priority:** MEDIUM

#### 11. packages/vector-memory - Tests

**Priority:** LOW

## Testing Best Practices for This Codebase

### 1. Use Vitest (Already Configured)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Core Pipeline', () => {
  it('transforms question to SQL', () => {
    // test
  });
});
```

### 2. Mock External Services

```typescript
import { vi } from 'vitest';

const mockProvider = {
  generateSQL: vi.fn().mockResolvedValue('SELECT * FROM users'),
};
```

### 3. Error Testing

```typescript
import { AskChokroError } from '@digitalchokro/core';

it('throws AskChokroError on invalid input', () => {
  expect(() => {
    // call with invalid input
  }).toThrow(AskChokroError);
});
```

### 4. Integration Test Pattern

```typescript
// Use temporary file/database for tests
const tmpDb = path.join(os.tmpdir(), `test-${Date.now()}.db`);

beforeEach(() => {
  // Initialize test database
});

afterEach(() => {
  // Clean up
  fs.unlinkSync(tmpDb);
});
```

## Timeline & Effort

| Phase | Packages | Effort | Timeline |
|-------|----------|--------|----------|
| Phase 1 | core, askchokro | 20 hours | Week 1-2 |
| Phase 2 | db-sqlite, adapter-express | 15 hours | Week 3-4 |
| Phase 3 | provider-openai, provider-ollama | 12 hours | Week 5-6 |
| Phase 4 | db-mysql, db-postgres | 18 hours | Week 7-8 |
| Phase 5 | Remaining 5 packages | 15 hours | Week 9-10 |
| **Total** | **All 14 packages** | **~80 hours** | **~2 months** |

## Commands to Track Progress

```bash
# Check test status
pnpm test

# Check specific package
pnpm --filter @digitalchokro/core test

# Run with coverage (after tests added)
pnpm test -- --coverage

# Watch mode for development
pnpm test -- --watch
```

## Success Criteria

- ✅ All packages have test directory structure
- ✅ Minimum 50% code coverage per package
- ✅ All CI pipelines green
- ✅ All edge cases covered (errors, edge values)
- ✅ Integration tests for adapters use Docker
- ✅ Provider tests mock external APIs

## Notes

1. **Priority Reordering**: If MySQL good-first-issue is claimed, deprioritize db-postgres slightly
2. **CI Integration**: Add test step to `.github/workflows/main.yml` with `pnpm test`
3. **Coverage Reporting**: Consider codecov.io integration for visibility
4. **Documentation**: Add `TESTING.md` guide for contributors
