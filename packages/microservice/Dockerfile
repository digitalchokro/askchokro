FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace configuration and lockfiles
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/microservice/package.json ./packages/microservice/
COPY packages/core/package.json ./packages/core/
COPY packages/askchokro/package.json ./packages/askchokro/
COPY packages/adapter-express/package.json ./packages/adapter-express/
COPY packages/db-mysql/package.json ./packages/db-mysql/
COPY packages/db-postgres/package.json ./packages/db-postgres/
COPY packages/db-sqlite/package.json ./packages/db-sqlite/
COPY packages/provider-anthropic/package.json ./packages/provider-anthropic/
COPY packages/provider-gemini/package.json ./packages/provider-gemini/
COPY packages/provider-ollama/package.json ./packages/provider-ollama/
COPY packages/provider-openai/package.json ./packages/provider-openai/

# Install dependencies (only what's needed for the microservice and its workspace deps)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the packages
RUN pnpm --filter @digitalchokro/microservice... build

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

# We need pnpm to run the built code easily if we don't prune, or we can just copy the built dists and node_modules.
# For simplicity, we copy the entire app and node_modules from the builder, but prune dev dependencies.
COPY --from=builder /app /app

RUN corepack enable && corepack prepare pnpm@latest --activate
# Prune dev dependencies to reduce image size
RUN pnpm --filter @digitalchokro/microservice... deploy --prod /prod/app

WORKDIR /prod/app
EXPOSE 3000

CMD ["node", "dist/index.js"]
