#!/bin/bash
# Comprehensive fix for Next.js build cache and dependency issues
# Usage: ./scripts/fix-cache.sh

set -e

echo "🔧 Fixing Next.js build cache and dependency issues..."

# Stop any running dev servers
echo "📛 Stopping dev servers..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :3002 | xargs kill -9 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Clear Next.js build cache
echo "🗑️  Clearing .next directory..."
rm -rf .next

# Clear node_modules cache
echo "🗑️  Clearing node_modules cache..."
rm -rf node_modules/.cache 2>/dev/null || true

# Clear npm cache (optional, uncomment if needed)
# echo "🗑️  Clearing npm cache..."
# npm cache clean --force

echo "✅ Cache cleared!"
echo ""
echo "Next steps:"
echo "  1. Run: npm install (or npm ci)"
echo "  2. Run: npx prisma generate"
echo "  3. Run: npm run dev"

