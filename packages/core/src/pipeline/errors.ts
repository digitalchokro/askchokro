/**
 * @digitalchokro/core — AskChokroError
 *
 * Every error thrown by the engine is typed with a code, message, and
 * actionable suggestion for the developer.
 */

export type ErrorCode =
  | 'SCHEMA_INTROSPECTION_FAILED'
  | 'SQL_GENERATION_FAILED'
  | 'SQL_VALIDATION_FAILED'
  | 'SQL_EXECUTION_FAILED'
  | 'SQL_EXECUTION_TIMEOUT'
  | 'TENANT_REWRITE_FAILED'
  | 'TENANT_REWRITE_UNSAFE'
  | 'RESPONSE_FORMATTING_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'TENANT_ID_MISSING'
  | 'PROVIDER_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NOT_IMPLEMENTED'
  | 'IP_WHITELIST_BLOCKED';

export class AskChokroError extends Error {
  readonly code: ErrorCode;
  readonly suggestion: string;
  readonly cause?: Error;

  constructor(code: ErrorCode, message: string, suggestion: string, cause?: Error) {
    super(message);
    this.name = 'AskChokroError';
    this.code = code;
    this.suggestion = suggestion;
    this.cause = cause;
  }
}
