# Recommended Models for AskChokro

> **This is a living document.** It is updated independently of SDK versions. Last reviewed: July 2026.

AskChokro is provider-agnostic — any model that can generate SQL from a natural-language prompt will work. However, not all models are equally good at Text-to-SQL. This guide documents our current recommendations based on accuracy testing against the AskChokro eval dataset.

## Local Models (via Ollama — free, no API key)

| Model | Size | Notes |
|---|---|---|
| **Qwen3** (latest) | 8B+ | Current best local model for SQL generation. Strong instruction-following. |
| **CodeGemma** | 7B | Good SQL accuracy for its size. |

> Check [Ollama's library](https://ollama.ai/library) for the latest available models. The field moves fast — test against the eval dataset before committing.

## API Models (paid, requires API key)

| Provider | Model | Notes |
|---|---|---|
| **OpenAI** | `gpt-4o` | Strong baseline. Excellent instruction-following for SQL. |
| **Anthropic** | `claude-sonnet-4-20250514` | Often better at complex multi-table JOINs. |
| **Google** | `gemini-2.5-pro` | Competitive accuracy. Good for cost-sensitive deployments. |

## How We Test

Every model recommendation is validated against the AskChokro eval dataset (`eval/dataset/`). We run the full harness and publish results in `eval/report.json`. Numbers are bootstrap accuracy — see the eval harness documentation for methodology details.

## How to Run Your Own Eval

```bash
# With Ollama running locally:
ASKCHOKRO_PROVIDER=ollama ASKCHOKRO_MODEL=qwen3 pnpm eval

# With OpenAI:
OPENAI_API_KEY=sk-... ASKCHOKRO_PROVIDER=openai ASKCHOKRO_MODEL=gpt-4o pnpm eval
```

## Contributing

Found a model that performs well? Open a PR updating this doc with your eval results. We accept recommendations backed by eval data, not vibes.
