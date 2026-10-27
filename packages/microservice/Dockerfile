FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.15.0

# Copy workspace configuration and packages
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages

# Install dependencies across workspace
RUN pnpm install --no-frozen-lockfile

WORKDIR /app/packages/microservice
EXPOSE 3000

# Verify the AskChokro microservice is running and database is connected
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
