import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@duckdb/node-api',
    '@duckdb/node-bindings',
    '@digitalchokro/db-duckdb',
    'better-sqlite3',
  ],
};

export default nextConfig;
