#!/bin/bash
set -e

echo "======================================"
echo "🚀 Running AskChokro E2E Integration Tests"
echo "======================================"

# Move to root
cd "$(dirname "$0")/../.."

# Ensure clean build
echo "📦 Building monorepo..."
pnpm install
pnpm build

# Pack all packages into a temp directory
echo "📦 Packing tarballs..."
rm -rf tests/e2e/packed && mkdir tests/e2e/packed
for dir in packages/*; do
  if [ -d "$dir" ]; then
    cd "$dir"
    pnpm pack > /dev/null
    mv *.tgz ../../tests/e2e/packed/
    cd ../../
  fi
done

cd tests/e2e
rm -rf node_modules package-lock.json

# Install all packed tarballs + testing dependencies
echo "📦 Installing tarballs in isolated environment..."
TARBALLS=$(find packed -name "*.tgz" -type f | sed 's/^/.\//' | tr '\n' ' ')
npm install $TARBALLS express next tsx typescript @types/express @types/node > /dev/null

echo "🧪 Running Express E2E Test..."
npx tsx express-test.ts

echo "🧪 Running Next.js E2E Test..."
npx tsx nextjs-test.ts

echo "======================================"
echo "✅ All E2E tests passed successfully!"
echo "======================================"
