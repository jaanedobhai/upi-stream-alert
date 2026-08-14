#!/bin/bash
set -e

echo "========================================================"
echo "🚀 UPI StreamAlert — 100% Cloud Deployment Setup"
echo "========================================================"
echo ""

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <YOUR_GITHUB_REPO_URL>"
  echo "Example: ./deploy.sh https://github.com/yourname/upi-stream-alert.git"
  echo ""
  read -p "Enter your GitHub Repository URL: " GITHUB_URL
else
  GITHUB_URL=$1
fi

if [ -z "$GITHUB_URL" ]; then
  echo "❌ Error: GitHub URL cannot be empty."
  exit 1
fi

echo "📦 Linking to GitHub: $GITHUB_URL..."
git remote remove origin 2>/dev/null || true
git remote add origin "$GITHUB_URL"
git branch -M main

echo "⬆️ Pushing code to GitHub..."
git push -u origin main

echo ""
echo "========================================================"
echo "✅ PUSH SUCCESSFUL!"
echo "========================================================"
echo "1. Go to your GitHub repository: $GITHUB_URL"
echo "2. Click on the 'Actions' tab at the top."
echo "3. Watch GitHub build your APK automatically in ~2 minutes."
echo "4. Download 'UPI-StreamAlert-debug-apk' and install on your phone!"
echo "========================================================"
