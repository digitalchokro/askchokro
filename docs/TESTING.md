# Testing Guide

AskChokro enforces a rigorous testing standard to guarantee zero-regressions across its 19 packages. We use `vitest` as our primary runner and maintain around 80% coverage.

## Running Tests

To run the full suite across all packages (Core, CLI, Microservice, Adapters, Providers):

```bash
# Run all tests
npx pnpm test

# Run tests with UI
npx pnpm test --ui

# Run tests for a specific package
npx pnpm test --filter="@digitalchokro/core"
```

## Test Types

1. **Unit Tests:** Found in `src/__tests__`. These use mocks (e.g., `vi.mock()`) to test components in isolation.
2. **Integration Tests:** Verifies that the adapters actually connect and process logic correctly. Some of these tests will try to spin up local in-memory SQLite instances as fallbacks if actual connections are missing.

## The Evaluation Harness

Because AskChokro relies on non-deterministic LLMs, standard unit tests aren't enough to verify accuracy. We built a specialized **Evaluation Harness** to benchmark AI models against our database.

### Running the Eval Harness

```bash
npx pnpm run eval
```

This command invokes `eval/runner.ts`, which:
1. Provisions a temporary SQLite database using `eval/dataset/seed.sql`.
2. Reads the expected queries from `eval/dataset/seed.json`.
3. Asks the configured LLM to generate SQL based on those natural language prompts.
4. Executes BOTH the AI's generated SQL and the Expected SQL.
5. Performs a deep equality check on the returned JSON rows to verify accuracy (not just string matching).

### Eval Reports

The harness generates two artifacts in the `/eval` directory:
- `report.json`: Machine-readable results.
- `report.html`: A beautiful, human-readable UI dashboard to see which prompts failed, the SQL generated vs expected, and the execution times.

### Adding New Evaluation Tests

To add a new benchmark test, append an entry to `eval/dataset/seed.json`:

```json
{
  "question": "Show all my products",
  "category": "Tenant Scoping",
  "expectedSql": "SELECT * FROM products WHERE business_id = 1"
}
```

The eval harness will automatically pick this up on the next run.
