# Production Deployment Guide

<p align="center">
  <picture>
    <img src="https://raw.githubusercontent.com/digitalchokro/askchokro/main/docs/assets/logo.png" width="800" height="2" style="background: linear-gradient(90deg, transparent, #252525, #8e9eab, #252525, transparent); border-radius: 5px;"/>
  </picture>
</p>

AskChokro provides multiple deployment pathways depending on your architecture.

```mermaid
flowchart TD
    subgraph Option 1: Embedded Node.js
        Next[Next.js / Express] --> Core[AskChokro Core]
        Core --> DB[(Database)]
    end
    
    subgraph Option 2: Docker Microservice
        External[Python / PHP / WP] -->|HTTP / JWT| Micro[AskChokro Docker]
        Micro --> DB2[(Database)]
    end
    
    subgraph Option 3: Edge Serverless
        CF[Cloudflare Worker] --> CoreEdge[AskChokro Core]
        CoreEdge --> Neon[(Neon Postgres HTTP)]
    end
    
    classDef highlight fill:#252525,stroke:#8e9eab,stroke-width:2px,color:#fff;
    class Core,Micro,CoreEdge highlight;
```

## Option 1: Embedding in Node.js (Next.js / Express / Fastify / Hono)

The easiest deployment strategy is embedding AskChokro directly inside your existing Node.js backend. This strategy provides zero network latency between your API layer and the AskChokro pipeline.

### Deployment Checklist

1. **Environment Variables:** Ensure `DATABASE_URL` and `OPENAI_API_KEY` (or equivalent) are securely injected into your production environment.
2. **Read-Only Database Credentials:** NEVER provide AskChokro with admin credentials. Create a dedicated database user with `GRANT SELECT ON ...` privileges. AskChokro enforces read-only access via AST validation, but defense-in-depth is required.
3. **Caching:** AskChokro uses an in-memory cache by default. For horizontally scaled deployments (e.g., Kubernetes or Serverless functions), provide a Redis-backed `CacheProvider` to share caches across instances.

## Option 2: The Standalone Microservice (Docker)

If you are using a non-Node.js backend (like Python Django, Ruby on Rails, or WordPress PHP), you can deploy AskChokro as a standalone microservice using our official Docker image.

### Running with Docker

```bash
docker pull digitalchokro/askchokro:latest

docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host/db" \
  -e OPENAI_API_KEY="sk-..." \
  -e JWT_SECRET="your-super-secure-secret-key" \
  digitalchokro/askchokro:latest
```

### Securing the Microservice

1. **Require JWTs:** Always set the `JWT_SECRET` environment variable. If omitted, the microservice runs in "Open Mode," meaning anyone on the internet can query your database by hitting the `/api/ask` endpoint.
2. **Reverse Proxy:** Place the container behind an Nginx or Traefik reverse proxy to handle SSL termination.
3. **Health Checks:** Use the `/health` endpoint for Kubernetes liveness/readiness probes.

## Option 3: Edge & Serverless (Cloudflare Workers)

Because AskChokro is heavily modularized, you can deploy it to edge environments like Cloudflare Workers using the Hono adapter.

Ensure you install `@digitalchokro/adapter-hono` and only use Edge-compatible database drivers (e.g., Neon serverless Postgres driver). You cannot use the standard `pg` or `mysql2` drivers in a Cloudflare Worker environment.
