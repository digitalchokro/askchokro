/**
 * @digitalchokro/core — Tenant & Request Context Types
 */

export interface TenantContext {
  /** The ID of the user making the request. Used for audit logging. */
  userId?: string;
  /** The tenant ID to scope all queries to. Required when tenantScoping is enabled. */
  tenantId?: string | number;
  /** Arbitrary metadata the developer can pass through to hooks. */
  metadata?: Record<string, unknown>;
  /** IP address of the requester. Used for IP Whitelist validation and audit logging. */
  ip?: string;
}
