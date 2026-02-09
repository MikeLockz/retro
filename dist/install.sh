#!/bin/bash
set -e

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS-$ARCH" in
  darwin-arm64)
    PLATFORM="macos-arm64"
    ;;
  darwin-x86_64)
    PLATFORM="macos-x64"
    ;;
  linux-x86_64)
    PLATFORM="linux-x64"
    ;;
  mingw*|msys*|cygwin*)
    PLATFORM="win-x64"
    ;;
  *)
    echo "Unsupported platform: $OS-$ARCH"
    exit 1
    ;;
esac

# Get latest release version
LATEST=$(curl -sL https://api.github.com/repos/MikeLockz/retro/releases/latest | grep '"tag_name"' | cut -d'"' -f4)

if [ -z "$LATEST" ]; then
    echo "Warning: Could not determine the latest release tag via API. Falling back to 'latest'..."
    LATEST="latest"
fi

echo "Installing RetroBoard TUI ${LATEST} for ${PLATFORM}..."

# Download binary
BINARY_URL="https://github.com/MikeLockz/retro/releases/download/${LATEST}/retro-tui-${PLATFORM}"

if [[ "$PLATFORM" == "win-x64" ]]; then
    curl -L "${BINARY_URL}.exe" -o retro-tui.exe
    echo "✓ Downloaded retro-tui.exe to current directory"
else
    # Try /usr/local/bin, fallback to current dir
    if [ -w /usr/local/bin ]; then
        curl -L "$BINARY_URL" -o /usr/local/bin/retro-tui
        chmod +x /usr/local/bin/retro-tui
        echo "✓ Installed to /usr/local/bin/retro-tui"
    else
        curl -L "$BINARY_URL" -o ./retro-tui
        chmod +x ./retro-tui
        echo "✓ Downloaded to ./retro-tui (no write permission for /usr/local/bin)"
    fi
fi

echo ""
echo "Usage:"
echo "  retro-tui my-room-name"

# Launch if argument provided
if [ ! -z "$1" ]; then
    if [[ "$PLATFORM" == "win-x64" ]]; then
        ./retro-tui.exe "$1"
    elif [ -x /usr/local/bin/retro-tui ]; then
        /usr/local/bin/retro-tui "$1"
    else
        ./retro-tui "$1"
    fi
fi
