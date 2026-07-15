# TESTING.md - AskChokro Testing Guide

Welcome! This guide explains how to write and run tests for AskChokro.

## Quick Start

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @digitalchokro/core test

# Run tests in watch mode
pnpm test -- --watch

# Run tests with coverage
pnpm test -- --coverage
```

---

## Current Status

**Test Coverage:** 80% (12/15 packages with tests, 159 tests passing)

| Package | Tests | Status |
|---------|-------|--------|
| core | 29 | ✅ SQL validation, injection prevention, tenant rewriting, types |
| askchokro | 18 | ✅ Auto-discovery, delegation, error forwarding |
| provider-openai | 20 | ✅ Initialization, messages, errors, token counting |
| provider-anthropic | 5 | ✅ generateSQL, formatResponse |
| provider-gemini | 6 | ✅ SQL tag parsing, chart format extraction |
| provider-ollama | 6 | ✅ Fetch mock, request body validation |
| db-sqlite | 13 | ✅ In-memory integration, schema, DML |
| db-postgres | 9 | ✅ Pool mock, information_schema |
| db-mysql | 8 | ✅ mysql2/promise mock, introspection |
| adapter-express | 10 | ✅ Middleware validation, error mapping |
| adapter-nextjs | 7 | ✅ App Router, NextResponse |
| microservice | 8 | ✅ Supertest: /health, JWT auth, tenant config |
| cli | 2 | ✅ Help text, --help flag |
| vector-memory | 0 | ❌ Not yet tested |
| playground | 0 | ❌ Not applicable |

---

## Testing Setup

### Technology Stack
- **Test Runner:** [Vitest](https://vitest.dev/) 2.0.0+
- **Language:** TypeScript
- **Configuration:** vitest.config.ts (root), vitest.workspace.ts (workspaces)

### Project Structure

Each package can have tests in two ways:

**Option 1: Co-located Tests** (Preferred)
```
packages/core/
  src/
    index.ts
    validator.ts
    __tests__/
      core.test.ts
      validator.test.ts
```

**Option 2: Separate Test Directory**
```
packages/core/
  src/
  tests/
    core.test.ts
```

We recommend **Option 1 (co-located)** — easier to maintain, keeps tests close to code.

---

## Writing Your First Test

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'hello';
    
    // Act
    const result = input.toUpperCase();
    
    // Assert
    expect(result).toBe('HELLO');
  });
});
```

### Patterns by Package Type

#### Core Package Tests
```typescript
import { describe, it, expect } from 'vitest';
import { AskChokroError } from '@digitalchokro/core';

describe('SQLValidator', () => {
  it('validates safe SQL', () => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    expect(validator.validate(sql)).toBe(true);
  });

  it('rejects SQL injection attempts', () => {
    const malicious = "SELECT * FROM users WHERE id = '1' OR '1'='1'";
    expect(validator.validate(malicious)).toBe(false);
  });

  it('throws AskChokroError on invalid input', () => {
    expect(() => {
      validator.validate(null);
    }).toThrow(AskChokroError);
  });
});
```

#### Provider Tests (Mock External APIs)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '@digitalchokro/provider-openai';

// Mock the openai package
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello!' } }]
        })
      }
    }
  }))
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider({ apiKey: 'test-key' });
  });

  it('generates SQL from question', async () => {
    const sql = await provider.generateSQL('What users exist?');
    expect(sql).toContain('SELECT');
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(
      new Error('Rate limited')
    );
    
    expect(async () => {
      await provider.generateSQL('test');
    }).rejects.toThrow();
  });
});
```

#### Adapter Tests (Use Mocks & Fixtures)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteAdapter } from '@digitalchokro/db-sqlite';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('SqliteAdapter', () => {
  let dbPath: string;
  let adapter: SqliteAdapter;

  beforeEach(() => {
    // Create temporary test database
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
    adapter = new SqliteAdapter({ filePath: dbPath });
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('creates and reads database schema', async () => {
    await adapter.exec('CREATE TABLE users (id INTEGER, name TEXT)');
    const schema = await adapter.getSchema();
    expect(schema.users).toBeDefined();
  });
});
```

---

## Assertion Patterns

### Common Assertions

```typescript
// Equality
expect(value).toBe(5);                    // Strict equality (===)
expect(value).toEqual({ a: 1 });         // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Numbers
expect(value).toBeGreaterThan(5);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(3.14, 2);

// Strings
expect(value).toContain('substring');
expect(value).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain('item');

// Objects
expect(object).toHaveProperty('key', 'value');

// Errors
expect(() => fn()).toThrow(Error);
expect(() => fn()).toThrow('specific message');

// Async
expect(promise).resolves.toEqual(value);
expect(promise).rejects.toThrow();

// Spies
expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledWith('arg1', 'arg2');
expect(spy).toHaveBeenCalledTimes(2);
```

---

## Mocking Strategies

### Mock External Dependencies

```typescript
// Mock a module
vi.mock('@google/genai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn().mockReturnValue(mockModel)
  }))
}));

// Mock a function
const mockFetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ data: 'test' })
});
global.fetch = mockFetch;

// Restore after test
afterEach(() => {
  vi.clearAllMocks();
});
```

### Mock Database Connections

```typescript
// Instead of real connection, create test fixture
const mockDb = {
  query: vi.fn().mockResolvedValue([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]),
  close: vi.fn()
};

// Use in test
const adapter = new SqliteAdapter({ db: mockDb });
```

### Mock API Responses

```typescript
// For testing providers
const mockResponse = {
  choices: [
    {
      message: {
        content: 'SELECT * FROM users'
      }
    }
  ]
};

vi.mocked(openai.chat.completions.create).mockResolvedValue(mockResponse);
```

---

## Test Organization

### Arrange-Act-Assert Pattern

```typescript
it('processes data correctly', () => {
  // ARRANGE - Set up test data
  const input = { name: 'Alice', age: 30 };
  
  // ACT - Execute the function
  const result = processUser(input);
  
  // ASSERT - Verify the result
  expect(result).toEqual({
    name: 'ALICE',
    ageGroup: '30-40'
  });
});
```

### Test Grouping with describe()

```typescript
describe('User Management', () => {
  describe('createUser()', () => {
    it('creates user with valid input');
    it('throws error on invalid email');
  });

  describe('deleteUser()', () => {
    it('deletes user by ID');
    it('returns 404 for non-existent user');
  });
});
```

### Using beforeEach/afterEach

```typescript
describe('Database Adapter', () => {
  let adapter: SqliteAdapter;

  beforeEach(async () => {
    // Set up test database before each test
    adapter = new SqliteAdapter({ filePath: ':memory:' });
    await adapter.init();
  });

  afterEach(async () => {
    // Clean up after each test
    await adapter.close();
  });

  it('can insert and retrieve data', async () => {
    // adapter is ready here
  });
});
```

---

## Testing Priority by Package

### CRITICAL (Start Here)

1. **@digitalchokro/core** (20 tests)
   - SQLValidator interface
   - Request/response types
   - Pipeline execution
   - Error handling

2. **@digitalchokro/askchokro** (15 tests)
   - Engine initialization
   - Question → SQL flow
   - Response formatting

### HIGH PRIORITY

3. **@digitalchokro/provider-openai** (15 tests)
   - API integration
   - Response parsing
   - Error handling

4. **@digitalchokro/db-sqlite** (20 tests)
   - Schema reading
   - Query execution
   - Error handling

5. **@digitalchokro/adapter-express** (15 tests)
   - Middleware routing
   - Request parsing
   - Error responses

### MEDIUM PRIORITY

6. **Other providers** (10-15 tests each)
   - provider-ollama
   - provider-anthropic
   - provider-gemini

7. **Other adapters** (10-15 tests each)
   - db-postgres
   - db-mysql
   - adapter-nextjs

8. **@digitalchokro/vector-memory** (10 tests)
   - Vector operations
   - Similarity search

---

## CI/CD Integration

### Running Tests in GitHub Actions

```yaml
# .github/workflows/main.yml
- name: Run tests
  run: pnpm test
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
pnpm test -- --changed
```

### Coverage Reports

```bash
# Generate coverage
pnpm test -- --coverage

# View coverage report
open coverage/index.html
```

---

## Debugging Tests

### Run Single Test File

```bash
pnpm test -- packages/core/src/__tests__/core.test.ts
```

### Run Tests Matching Pattern

```bash
pnpm test -- -t "should validate SQL"
```

### Watch Mode

```bash
pnpm test -- --watch
```

### Debug Mode (Node Inspector)

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall: Using `any` in tests
```typescript
// BAD
const result: any = await fn();

// GOOD
const result: ExpectedType = await fn();
```

### ❌ Pitfall: Not cleaning up resources
```typescript
// BAD
it('tests database', async () => {
  const db = new Database(':memory:');
  // db never closed!
});

// GOOD
afterEach(() => {
  db.close();
});
```

### ❌ Pitfall: Testing implementation details
```typescript
// BAD
expect(obj._privateField).toBe(5);

// GOOD
expect(obj.getPublicValue()).toBe(5);
```

### ❌ Pitfall: Flaky async tests
```typescript
// BAD
it('fetches data', async () => {
  fn();
  // No await - race condition!
  expect(data).toBeDefined();
});

// GOOD
it('fetches data', async () => {
  const data = await fn();
  expect(data).toBeDefined();
});
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [AskChokro Architecture](./ARCHITECTURE.md)
- [Stub Test Examples](./TEST_COVERAGE_ROADMAP.md)

---

## Getting Help

- Check existing tests in `packages/cli/src/__tests__/` for patterns
- Review test stubs in TEST_COVERAGE_ROADMAP.md
- Read relevant package README.md files
- Open an issue on GitHub for questions

---

## Contributing Tests

1. Pick a package from TEST_COVERAGE_ROADMAP.md
2. Create `src/__tests__/` directory if it doesn't exist
3. Write tests following patterns above
4. Run `pnpm test` to verify
5. Open PR with your test suite

**Thank you for improving AskChokro! 🙏**
