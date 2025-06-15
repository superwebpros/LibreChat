#!/bin/bash

# docker-sync-qdrant.sh
# Runs the sync-qdrant.js script using Docker to avoid Node.js version issues

set -e

echo "📦 LibreChat Qdrant Vector Store Sync Tool (Docker Version) 📦"
echo "=============================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in your PATH"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if .env.qdrant exists
if [ ! -f .env.qdrant ]; then
    echo "⚠️  Warning: .env.qdrant file not found"
    echo "Creating a template .env.qdrant file..."
    cat > .env.qdrant << 'EOL'
# LibreChat Qdrant Vector Store Sync Configuration
# This file contains environment variables for the sync-qdrant.js script

# OpenAI API Key - Required for generating embeddings
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# The following variables are already configured in the script
# but can be overridden here if needed:
# QDRANT_URL=https://q.superwebpros.com
# QDRANT_API_KEY=your_qdrant_api_key_here
