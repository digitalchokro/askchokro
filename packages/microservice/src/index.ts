import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { AskChokro } from '@digitalchokro/askchokro';
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
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    // Attach decoded payload to a custom property (e.g., req.askContext)
    // The createAskChokroMiddleware looks for req.tenantContext or similar?
    // Wait, createAskChokroMiddleware allows passing context implicitly if we use it, 
    // but the default adapter-express extracts `req.body.context` by default!
    // Let's pass the decoded JWT directly into the body's context so the adapter picks it up.
    if (typeof payload === 'object' && payload !== null) {
      req.body = req.body || {};
      // Merge the secure JWT payload into the context so the AST rewriter can use it!
      req.body.context = { ...req.body.context, ...payload };
    }
    next();
  } catch (err) {
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
      getValue: (ctx: any) => ctx.wp_user_id,
    } : undefined
  }
});

// Mount the AskChokro express adapter on /api/ask
// The authMiddleware guarantees that only valid WP plugins (or authorized clients) can hit this endpoint.
app.post('/api/ask', authMiddleware, createAskChokroMiddleware(agent as any));

app.listen(PORT, () => {
  console.log(`🚀 AskChokro Microservice is running on http://localhost:${PORT}`);
  if (JWT_SECRET) {
    console.log('🔒 JWT Authentication is ENABLED.');
  } else {
    console.log('⚠️ JWT Authentication is DISABLED. (Set JWT_SECRET to secure the endpoint)');
  }
});
