#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment process..."

# Build the project
echo "📦 Building the project..."
npm run build

# Copy files to GitHub Pages repository
echo "📋 Copying files to GitHub Pages repository..."
cp -r dist/* ../audacity88.github.io/

# Navigate to GitHub Pages repository
echo "📂 Navigating to GitHub Pages repository..."
cd ../audacity88.github.io

# Add changes to git
echo "🔄 Adding changes to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
read -p "Enter commit message (default: Update site): " commit_message
git commit -m "Update site"

# Push changes
echo "⬆️ Pushing changes to GitHub..."
git push origin master

echo "✅ Deployment complete! Your site will be updated in a few minutes."
echo "🌎 Visit your site at: https://audacity88.github.io" 