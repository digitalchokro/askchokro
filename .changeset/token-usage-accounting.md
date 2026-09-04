---
'@digitalchokro/core': minor
'@digitalchokro/provider-openai': minor
'@digitalchokro/provider-anthropic': minor
'@digitalchokro/provider-gemini': minor
'@digitalchokro/provider-vertex': minor
'@digitalchokro/provider-groq': minor
'@digitalchokro/provider-ollama': minor
---

Report real prompt and completion token counts on `AskResult.tokenUsage`.

`AIProvider` gains an optional `consumeUsage(): TokenUsage`, which returns the usage accumulated since the last call and resets the counter — a drain, not a peek. The agent drains after generation and again after formatting, so one question's total covers every model call made for it, retries included. All six bundled providers implement it, including across streaming responses. Providers that cannot report usage simply omit the method and `tokenUsage` stays at zero rather than being estimated.

Also exported from `@digitalchokro/core` for plugin authors: the `TokenUsage` type and the `UsageAccumulator` helper the bundled providers use.
