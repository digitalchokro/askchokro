---
'@digitalchokro/core': minor
---

Add `sqlCacheTtl` to `AgentOptions`, and export the SQL guards and cache provider.

`sqlCacheTtl` sets the TTL for the question → generated-SQL cache (Tier 1), which was previously fixed at one hour with no way to change it. Lower it so schema changes and prompt tuning take effect sooner, since a cached question bypasses the model entirely until its entry expires.

`applyRowLimit`, `isCannotAnswer`, `CANNOT_ANSWER_SQL` and `InMemoryCacheProvider` are now public exports. The `CANNOT_ANSWER` sentinel in particular was being recognised by ad-hoc string comparison in each provider; sharing one predicate means every provider agrees on what counts as a refusal.
