#!/bin/bash
# Complete cleanup script - removes build cache, node_modules, and reinstalls
# Usage: ./scripts/clean-all.sh

set -e

echo "🧹 Complete cleanup and reinstall..."

# Stop any running dev servers
echo "📛 Stopping dev servers..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :3002 | xargs kill -9 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Remove build artifacts
echo "🗑️  Removing .next directory..."
rm -rf .next

# Remove node_modules
echo "🗑️  Removing node_modules..."
rm -rf node_modules

# Remove package-lock.json (optional - uncomment if you want fresh lock file)
# echo "🗑️  Removing package-lock.json..."
# rm -f package-lock.json

# Clear npm cache
echo "🗑️  Clearing npm cache..."
npm cache clean --force

# Clear node_modules cache
echo "🗑️  Clearing node_modules cache..."
rm -rf node_modules/.cache 2>/dev/null || true

# Reinstall dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo ""
echo "✅ Complete cleanup finished!"
echo ""
echo "You can now run: npm run dev"

