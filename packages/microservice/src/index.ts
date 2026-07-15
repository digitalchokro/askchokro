import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { AskChokro, type TenantContext } from '@digitalchokro/askchokro';
import { createAskChokroMiddleware, createAskChokroStreamMiddleware } from '@digitalchokro/adapter-express';

export interface AppConfig {
  jwtSecret?: string;
  enableTenantScoping?: boolean;
  tenantColumn?: string;
}

/**
 * Creates and configures the Express app and AskChokro agent.
 * Exported separately to allow testing without binding to a port.
 */
export function createApp(config: AppConfig = {}) {
  const JWT_SECRET = config.jwtSecret ?? process.env.JWT_SECRET;
  const ENABLE_TENANT_SCOPING = config.enableTenantScoping ?? process.env.ENABLE_TENANT_SCOPING === 'true';
  const TENANT_COLUMN = config.tenantColumn ?? process.env.TENANT_COLUMN ?? 'post_author';

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Authentication Middleware
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void | express.Response => {
    if (!JWT_SECRET) {
      console.warn('⚠️ No JWT_SECRET provided. The /api/ask endpoint is open to the public.');
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (typeof payload === 'object' && payload !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        req.body = req.body || {};

        // Phase 3: Multi-Tenant Support for Dokan / WCFM
        // The JWT payload is expected to contain `vendor_id` (set by the WP plugin).
        // We map it here to `tenantId` so DatabaseAgent can scope SQL automatically.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        const p = payload as Record<string, unknown>;
        const tenantId = p.vendor_id ?? p.user_id ?? null;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body.context = {
          ...req.body.context,
          ...p,
          ...(tenantId !== null ? { tenantId: String(tenantId) } : {})
        };
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // Initialize the AskChokro engine
  // It automatically picks up DATABASE_URL and API keys from the environment
  const agent = new AskChokro({
    options: {
      tenantScoping: ENABLE_TENANT_SCOPING ? {
        enabled: true,
        column: TENANT_COLUMN,
        // Phase 3: vendor_id is mapped to tenantId by the auth middleware above.
        // Fall back to wp_user_id for backwards compatibility.
        getValue: (ctx: TenantContext) => {
          const c = ctx as Record<string, unknown>;
          return String(c.tenantId ?? c.vendor_id ?? c.wp_user_id ?? '');
        },
      } : undefined
    }
  });

  // Mount the AskChokro express adapter on /api/ask (standard JSON)
  // The authMiddleware guarantees that only valid WP plugins (or authorized clients) can hit this endpoint.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  app.post('/api/ask', authMiddleware, createAskChokroMiddleware(agent as any) as any);

  // Streaming endpoint (Server-Sent Events)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  app.post('/api/ask/stream', authMiddleware, createAskChokroStreamMiddleware(agent as any, {
    getContext: (req) => (req.body as { context?: TenantContext }).context ?? {}
  }) as any);

  // Deep health check
  app.get('/health', async (req, res) => {
    const isHealthy = await agent.ping();
    if (isHealthy) {
      res.json({ status: 'ok', engine: 'AskChokro Microservice', database: 'connected' });
    } else {
      res.status(503).json({ status: 'error', engine: 'AskChokro Microservice', database: 'disconnected' });
    }
  });

  return { app, agent };
}

// ---- Server entrypoint (not imported by tests) ----
// Load environment variables if not running in a container
import 'dotenv/config';

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const { app } = createApp();

app.listen(PORT, () => {
  console.log(`🚀 AskChokro Microservice is running on http://localhost:${PORT}`);
  if (JWT_SECRET) {
    console.log('🔒 JWT Authentication is ENABLED.');
  } else {
    console.log('⚠️ JWT Authentication is DISABLED. (Set JWT_SECRET to secure the endpoint)');
  }
});
