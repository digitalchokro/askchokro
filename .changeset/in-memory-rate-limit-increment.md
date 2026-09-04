---
'@digitalchokro/core': patch
---

Implement `increment()` on `InMemoryCacheProvider` so per-tenant rate limiting works with the default cache.

The counter's expiry is set only when the counter is created, so the window runs a fixed `windowSeconds` from the first request instead of sliding forward on every hit — a steady stream of traffic can no longer hold the window open indefinitely and prevent the count from ever resetting. Note that a fixed window inherently permits up to 2× `maxRequests` across a window boundary, and that this provider is per-process: use a Redis-backed cache to rate limit across instances.
