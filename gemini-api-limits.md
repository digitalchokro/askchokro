# Gemini API Rate Limits (Free Tier)

**Important note:** If you're running the `askchokro` eval harness (which has 92 test cases), you **must** use `gemini-3.1-flash-lite` or a model with a high enough Daily Quota (RPD) to finish the tests.

## Model Limits

| Model | RPM (Requests/Min) | RPD (Requests/Day) | TPM (Tokens/Min) |
|---|---|---|---|
| **Gemini 2.5 Flash** (also `gemini-2.0-flash`) | 5 | 20 | 250K |
| **Gemini 3.1 Flash Lite** | 15 | 500 | 250K |
| **Gemini 3.5 Flash** | 5 | 20 | 250K |
| **Gemini Robotics ER 1.6 Preview** | 5 | 20 | 250K |

## Strategy for Evals

If running `pnpm eval`:
- ❌ Do NOT use `gemini-2.0-flash` or `gemini-2.5-flash` (it only has a quota of 20 queries/day, eval will fail).
- ✅ Use `gemini-3.1-flash-lite` (has a quota of 500 queries/day and 15 RPM, which is plenty for the 92 test cases).
