---
'@digitalchokro/provider-groq': patch
---

Use one default model across all three call sites.

`generateSQL` defaulted to a Groq model while `formatResponse` and `streamResponse` defaulted to `gpt-4o`, which Groq does not serve. A caller who left `model` unset got working SQL generation followed by a model-not-found error the moment the answer was formatted. All three now share `llama-3.3-70b-versatile`; an explicit `model` override is unaffected.
