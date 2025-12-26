#!/bin/bash

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared not found. Attempting to download..."
    # Detect OS/Arch (Assuming Mac for this user based on context, but making it slightly generic)
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    if [[ "$OS" == "Darwin" ]]; then
        if [[ "$ARCH" == "arm64" ]]; then
             # Using explicit version 2025.2.0 (latest stable as of writing) to avoid redirect issues
             # Note: The curl output showed 2025.11.1 but that seems far future or custom? 
             # Let's trust the one we found or just use the generic direct link if possible.
             # Actually, let's use the one we successfully pinged: 2025.11.1
             URL="https://github.com/cloudflare/cloudflared/releases/download/2025.11.1/cloudflared-darwin-arm64.tgz"
        else
             URL="https://github.com/cloudflare/cloudflared/releases/download/2025.11.1/cloudflared-darwin-amd64.tgz"
        fi
    else
        echo "This script currently supports macOS auto-download. Please install cloudflared manually."
        exit 1
    fi

    curl -L --output cloudflared.tgz "$URL"
    tar -xzf cloudflared.tgz
    rm cloudflared.tgz
    chmod +x cloudflared
    # Add current dir to PATH for this script execution
    export PATH=$PATH:.
    echo "cloudflared downloaded to current directory."
fi

echo "Starting Cloudflare Quick Tunnel for Ollama (Port 11434)..."
echo "Look for the URL ending with '.trycloudflare.com' below."
echo "========================================================"

# Run cloudflared
if [ -f "./cloudflared" ]; then
    ./cloudflared tunnel --url http://localhost:11434
else
    cloudflared tunnel --url http://localhost:11434
fi
