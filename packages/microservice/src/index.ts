import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { AskChokro, type TenantContext } from '@digitalchokro/askchokro';
import { createAskChokroMiddleware } from '@digitalchokro/adapter-express';

// Load environment variables if not running in a container
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', engine: 'AskChokro Microservice' });
});

// Authentication Middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void | express.Response => {
  // If no JWT_SECRET is set, run in open/insecure mode
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      req.body.context = { ...req.body.context, ...payload };
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Initialize the AskChokro engine
// It automatically picks up DATABASE_URL and API keys from the environment
const ENABLE_TENANT_SCOPING = process.env.ENABLE_TENANT_SCOPING === 'true';
const TENANT_COLUMN = process.env.TENANT_COLUMN || 'post_author';

const agent = new AskChokro({
  options: {
    tenantScoping: ENABLE_TENANT_SCOPING ? {
      enabled: true,
      column: TENANT_COLUMN,
      getValue: (ctx: TenantContext) => String((ctx as Record<string, unknown>).wp_user_id),
    } : undefined
  }
});

// Mount the AskChokro express adapter on /api/ask
// The authMiddleware guarantees that only valid WP plugins (or authorized clients) can hit this endpoint.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
app.post('/api/ask', authMiddleware, createAskChokroMiddleware(agent as any) as any);

app.listen(PORT, () => {
  console.log(`🚀 AskChokro Microservice is running on http://localhost:${PORT}`);
  if (JWT_SECRET) {
    console.log('🔒 JWT Authentication is ENABLED.');
  } else {
    console.log('⚠️ JWT Authentication is DISABLED. (Set JWT_SECRET to secure the endpoint)');
  }
});
