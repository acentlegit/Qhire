#!/bin/bash
# Stop all servers and start QHire cleanly

echo "🛑 Stopping all Next.js servers..."
pkill -f "next dev" 2>/dev/null
lsof -ti:3000,3001,3002,3003,3004,3005,3006,3007 | xargs kill -9 2>/dev/null
sleep 2

echo "✅ All servers stopped"
echo ""

echo "📁 Navigating to QHire directory..."
cd /Users/bhanukiran/Downloads/ACENTLE/QHire/Qhire_Full_Production

echo "🧹 Cleaning cache..."
rm -rf .next

echo "🔧 Generating Prisma client..."
npx prisma generate

echo ""
echo "🚀 Starting QHire on port 3000..."
echo ""
PORT=3000 npm run dev

