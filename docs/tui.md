⏺ RetroBoard TUI - Complete Project Plan

  Executive Summary

  Goal: Create a terminal UI (TUI) for RetroBoard that syncs with browser users via WebRTC P2P, distributed as a single downloadable binary.

  Key Discovery: Pure JavaScript WebRTC implementations (werift) are incompatible with y-webrtc. Native wrtc package is required but needs compilation. Solution: Compile once, distribute binaries.

  Architecture Overview

  ┌─────────────────────────────────────────────────────────┐
  │                   Deployment Strategy                    │
  ├─────────────────────────────────────────────────────────┤
  │                                                          │
  │  Browser Users (Unchanged):                             │
  │  ├─ GitHub Pages → Static HTML/JS                       │
  │  └─ WebRTC P2P mesh (existing)                          │
  │                                                          │
  │  Terminal Users (New):                                  │
  │  ├─ GitHub Releases → Compiled binaries                 │
  │  │   ├─ retro-macos-arm64 (Apple Silicon)              │
  │  │   ├─ retro-macos-x64 (Intel Mac)                    │
  │  │   ├─ retro-linux-x64                                 │
  │  │   └─ retro-windows-x64.exe                           │
  │  └─ Same WebRTC P2P mesh                                │
  │                                                          │
  │  Both use: Cloudflare signaling server (existing)       │
  └─────────────────────────────────────────────────────────┘

  Technical Discoveries

  What We Learned

  1. Y.Doc GUID must match - All clients in same room need identical doc GUID (use room name)
  2. IndexedDB caching issues - Browser caches old docs, need versioned DB names
  3. werift is incompatible - Pure JS WebRTC doesn't work with simple-peer API
  4. wrtc compilation is tricky - But only needs to happen once in CI/CD
  5. Platform abstraction works - Our DRY architecture is solid

  Why Native wrtc is Required

  // What simple-peer (used by y-webrtc) expects:
  {
    RTCPeerConnection: [native class],
    RTCSessionDescription: [native class],
    RTCIceCandidate: [native class]
  }

  // What werift provides:
  // Similar API but different implementation details
  // Result: Peer objects created but immediately disconnected

  Implementation Plan

  Phase 1: Get wrtc Working Locally ✓ (DONE)

  Status: Just completed - @roamhq/wrtc installed successfully

  What we have:
  - ✓ @roamhq/wrtc package with prebuilt binaries
  - ✓ Platform abstraction layer (src/core/platform/)
  - ✓ Shared store logic (src/core/createStore.js)
  - ✓ TUI components (tui/components/)

  Next: Test it works

  Phase 2: Switch TUI to use @roamhq/wrtc

  Files to modify:

  src/core/platform/node.js
  ├─ Change: import from 'werift' → import from '@roamhq/wrtc'
  └─ Keep: Same API (RTCPeerConnection, etc.)

  package.json
  ├─ Remove: werift
  └─ Keep: @roamhq/wrtc (already installed)

  Expected result: Browser ↔ Terminal sync works!

  Phase 3: Bundle into Standalone Binary

  Tool: Use @yao-pkg/pkg (maintained fork of pkg)

  npm install --save-dev @yao-pkg/pkg

  Create bundle config (pkg-config.json):
  {
    "name": "retro-tui",
    "version": "1.0.0",
    "bin": "tui/index.jsx",
    "pkg": {
      "targets": [
        "node18-macos-arm64",
        "node18-macos-x64",
        "node18-linux-x64",
        "node18-win-x64"
      ],
      "assets": [
        "node_modules/@roamhq/wrtc/**/*"
      ],
      "outputPath": "dist/binaries"
    }
  }

  Add build script (package.json):
  {
    "scripts": {
      "build:tui-binary": "pkg tui/index.jsx --compress GZip --out-path dist/binaries"
    }
  }

  Test locally:
  npm run build:tui-binary
  ./dist/binaries/retro-tui-macos-arm64 my-room

  Phase 4: GitHub Actions for Multi-Platform Builds

  Create .github/workflows/build-tui.yml:

  name: Build TUI Binaries

  on:
    push:
      tags:
        - 'v*'
    workflow_dispatch:

  jobs:
    build:
      strategy:
        matrix:
          include:
            - os: macos-latest
              target: macos-arm64
            - os: macos-13
              target: macos-x64
            - os: ubuntu-latest
              target: linux-x64
            - os: windows-latest
              target: win-x64

      runs-on: ${{ matrix.os }}

      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: '18'

        - name: Install dependencies
          run: npm ci

        - name: Build binary
          run: npm run build:tui-binary

        - name: Upload artifact
          uses: actions/upload-artifact@v4
          with:
            name: retro-tui-${{ matrix.target }}
            path: dist/binaries/retro-tui-*

    release:
      needs: build
      runs-on: ubuntu-latest
      if: startsWith(github.ref, 'refs/tags/')

      steps:
        - uses: actions/download-artifact@v4

        - name: Create Release
          uses: softprops/action-gh-release@v1
          with:
            files: |
              retro-tui-*/retro-tui-*

  Phase 5: Distribution via curl

  Create install script (dist/install.sh):

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
  LATEST=$(curl -sL https://api.github.com/repos/YOUR_USERNAME/retro/releases/latest | grep '"tag_name"' | cut -d'"' -f4)

  echo "Installing RetroBoard TUI ${LATEST} for ${PLATFORM}..."

  # Download binary
  BINARY_URL="https://github.com/YOUR_USERNAME/retro/releases/download/${LATEST}/retro-tui-${PLATFORM}"
  curl -L "$BINARY_URL" -o /usr/local/bin/retro-tui
  chmod +x /usr/local/bin/retro-tui

  echo "✓ Installed to /usr/local/bin/retro-tui"
  echo ""
  echo "Usage:"
  echo "  retro-tui my-room-name"

  User experience:
  # One-time install
  curl -fsSL https://yourname.github.io/retro/install.sh | bash

  # Use anywhere
  retro-tui my-retro-room

  Phase 6: Update README

  Add section:

  ## Installation

  ### Browser (No Install)
  Open: https://yourname.github.io/retro/#room-name

  ### Terminal (One-Line Install)
  ```bash
  curl -fsSL https://yourname.github.io/retro/install.sh | bash

  Then join a room:
  retro-tui my-retro-room

  Features

  - ✅ Real-time P2P sync between browser and terminal
  - ✅ No server required (P2P WebRTC)
  - ✅ Offline-first (browser only)
  - ✅ Works across platforms (Mac, Linux, Windows)

  ## File Structure (Final)

  retro/
  ├── .github/
  │   └── workflows/
  │       └── build-tui.yml          # CI/CD for binaries
  ├── src/
  │   ├── core/
  │   │   ├── createStore.js         # Shared Yjs logic
  │   │   └── platform/
  │   │       ├── browser.js         # Browser-specific
  │   │       └── node.js            # Terminal-specific (uses @roamhq/wrtc)
  │   ├── Store.js                   # Browser entry
  │   ├── App.jsx                    # Browser UI
  │   └── components/                # Browser components
  ├── tui/
  │   ├── index.jsx                  # Terminal entry
  │   └── components/                # Terminal Ink components
  ├── dist/
  │   ├── install.sh                 # curl installer
  │   └── binaries/                  # Built executables (gitignored)
  ├── package.json
  └── README.md

  ## Testing Plan

  ### Test 1: Local wrtc
  ```bash
  # Switch to @roamhq/wrtc
  # Run: npm run tui test-room
  # Expected: Connects to browser, syncs cards

  Test 2: Binary Build

  npm run build:tui-binary
  ./dist/binaries/retro-tui-macos-arm64 test-room
  # Expected: Same as npm run tui

  Test 3: Cross-Platform

  # In GitHub Actions
  # Expected: Builds for all 4 platforms without errors

  Test 4: Install Script

  curl -fsSL https://yourname.github.io/retro/install.sh | bash
  retro-tui test-room
  # Expected: Downloads, installs, runs successfully

  Success Criteria

  - Terminal syncs with browser in real-time
  - Binary works on Mac (both architectures)
  - Binary works on Linux
  - Binary works on Windows
  - Install script auto-detects platform
  - Install is truly one command
  - No npm/node required for end users
  - File size < 50MB per binary

  Risks & Mitigation
  Risk: wrtc compilation fails in CI
  Impact: High
  Mitigation: Use matrix with multiple Node versions, test locally first
  ────────────────────────────────────────
  Risk: Binaries too large
  Impact: Medium
  Mitigation: Use compression, exclude unnecessary deps
  ────────────────────────────────────────
  Risk: Platform detection fails
  Impact: Low
  Mitigation: Provide manual download links as fallback
  ────────────────────────────────────────
  Risk: Native module bundling issues
  Impact: High
  Mitigation: Test pkg configuration thoroughly
  Timeline Estimate

  - Phase 2 (Switch to wrtc): 30 minutes
  - Phase 3 (Bundle binary): 2 hours
  - Phase 4 (GitHub Actions): 2 hours
  - Phase 5 (Install script): 1 hour
  - Phase 6 (Documentation): 30 minutes
  - Testing: 2 hours