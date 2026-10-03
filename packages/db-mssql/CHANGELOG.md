# @digitalchokro/db-mssql

## 1.0.2

### Patch Changes

- 69f322d: Bind query parameters, enforce `queryTimeoutMs`, and stop crashing on statements that return no rows.

  Three fixes to `MssqlAdapter.execute()`:

  - The `params` argument was accepted and then dropped on the floor. Positional values are now bound as the driver's named `@p0`, `@p1`, … parameters, so write `execute('SELECT * FROM users WHERE id = @p0', [42])`. Values travel separately from the statement and are never concatenated into it.
  - `queryTimeoutMs` was likewise accepted and ignored. It is now enforced with `request.cancel()`, which cancels server-side so a runaway query stops burning database time instead of continuing after we stop waiting for it.
  - `result.recordset` is `undefined` for statements that return no result set, and reading `.length` off it threw. Those now report zero rows.

## 1.0.1

### Patch Changes

- Updated dependencies [0441f9e]
  - @digitalchokro/core@1.1.6
