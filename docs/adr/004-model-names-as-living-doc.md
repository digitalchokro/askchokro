# ADR 004: Model Names as a Living Document

## Status
Accepted

## Context
Text-to-SQL quality depends heavily on the AI model used. Model quality changes every 2–4 months as new releases appear. Claims like "uses Qwen2.5-Coder, the best model for SQL" become wrong within one release cycle.

If we bake model names or "recommended model" strings into our source code, config defaults, or README hero examples, every new model release creates a documentation debt — or worse, silently leads users to suboptimal results because our hardcoded default was state-of-the-art six months ago.

## Decision
1. **No model name appears in any source code file** (except in test fixtures where a specific model is needed for reproducibility).
2. The AI Provider interfaces accept a `model` config field that is a plain string — no enum, no validation against a known list.
3. A dedicated `docs/RECOMMENDED_MODELS.md` file is maintained as a **living document**, updated independently of SDK version releases.
4. The README hero example uses `'your-chosen-model'` as the model value, with a link to `RECOMMENDED_MODELS.md`.

## Consequences
- The SDK never needs a breaking change just because a model is deprecated or a better one appears.
- Users are directed to a single, always-current document for model guidance.
- Trade-off: we lose the ability to provide a "works out of the box with no config" default model name. Mitigated by the zero-config mode's auto-detection, which delegates model selection to the provider package's own defaults (which can be updated independently).
