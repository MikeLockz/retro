# RetroBoard TUI - Detailed Implementation Plan

## Overview

This plan breaks down the TUI implementation into small, testable increments with validation at each step. Each step can be verified independently before moving forward.

---

## Prerequisites Check

**Before starting, verify:**

- [ ] Current TUI works with werift (baseline)
- [ ] @roamhq/wrtc is installed
- [ ] Browser version works correctly
- [ ] Git branch is clean or changes are stashed

**Validation:**
```bash
# Test current state
npm run tui test-baseline

# Open browser
# Go to https://localhost:5173/#test-baseline
# Verify: Should see connection issues or no sync
```

---

## Phase 1: Switch to @roamhq/wrtc ✓ (Already Done)

**Status:** COMPLETED
- @roamhq/wrtc package installed
- Ready to integrate

---

## Phase 2: Enable wrtc Integration (Small Steps)

### Step 2.1: Update Platform Abstraction Layer

**Files to modify:** `src/core/platform/node.js`

**Change:**
```javascript
// OLD
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'werift'

// NEW
import wrtc from '@roamhq/wrtc'
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = wrtc
```

**Validation:**
```bash
# Should not throw import errors
node -e "require('./src/core/platform/node.js')"
```

**Expected:** No errors
**Rollback:** `git checkout src/core/platform/node.js`

---

### Step 2.2: Test TUI Startup

**Action:** Start TUI with new wrtc

**Validation:**
```bash
npm run tui test-room-001
```

**Expected:**
- TUI starts without crashes
- No import/module errors
- Shows "Connecting..." or room interface
- May not sync yet (that's next)

**If fails:**
- Check error message
- Verify wrtc installed: `npm list @roamhq/wrtc`
- Check Node version: `node --version` (should be 18+)

**Rollback:** Step 2.1 rollback

---

### Step 2.3: Test Browser-TUI Sync (Critical Test)

**Action:** Test real-time sync between browser and terminal

**Validation:**
```bash
# Terminal 1
npm run tui test-room-sync

# Terminal 2 (or browser)
# Open: http://localhost:5173/#test-room-sync
npm run dev  # if needed
```

**Test sequence:**
1. Start TUI first → should show empty board
2. Open browser → should show empty board
3. Add card in browser → should appear in TUI
4. Add card in TUI → should appear in browser
5. Move card in browser → should update in TUI
6. Vote in TUI → should update in browser

**Success criteria:**
- Cards sync within 2 seconds
- No disconnections
- No duplicate cards
- Moves and votes sync correctly

**If fails:**
- Check console logs in both
- Verify same room name
- Check signaling server status
- Look for WebRTC connection errors

**Debug commands:**
```bash
# Enable verbose logging
DEBUG=y-webrtc:* npm run tui test-room-sync
```

---

### Step 2.4: Test Multiple TUI Clients

**Action:** Test multiple terminal clients in same room

**Validation:**
```bash
# Terminal 1
npm run tui multi-test

# Terminal 2
npm run tui multi-test

# Terminal 3
npm run tui multi-test
```

**Expected:**
- All 3 see each other's changes
- Cards sync across all terminals
- No conflicts or duplicates

---

### Step 2.5: Clean Up Old Dependencies

**Files to modify:** `package.json`

**Change:**
```bash
npm uninstall werift
```

**Validation:**
```bash
# Verify werift is gone
npm list werift  # Should show "empty"

# Verify TUI still works
npm run tui test-cleanup
```

**Checkpoint:** `git add -A && git commit -m "feat: switch TUI to use @roamhq/wrtc for WebRTC"`

---

## Phase 3: Create Standalone Binary (Incremental)

### Step 3.1: Install Packaging Tool

**Action:**
```bash
npm install --save-dev @yao-pkg/pkg
```

**Validation:**
```bash
npm list @yao-pkg/pkg
npx pkg --version
```

**Expected:** Version number displayed

---

### Step 3.2: Create Minimal Binary Config

**Files to create:** `package.json` (add to scripts section)

**Change:**
```json
{
  "scripts": {
    "build:tui-binary": "pkg tui/index.jsx --target node18-macos-arm64 --output dist/binaries/retro-tui"
  }
}
```

**Note:** Start with single platform (your current one)

---

### Step 3.3: Test Basic Binary Build

**Action:**
```bash
npm run build:tui-binary
```

**Expected:**
- Creates `dist/binaries/retro-tui`
- File size: 30-60 MB (approximate)
- No build errors

**Validation:**
```bash
ls -lh dist/binaries/retro-tui
file dist/binaries/retro-tui
```

**If fails:**
- Check Node version compatibility
- Verify entry point exists: `tui/index.jsx`
- Check pkg error messages

---

### Step 3.4: Test Binary Execution (No Network)

**Action:**
```bash
./dist/binaries/retro-tui --help
# or
./dist/binaries/retro-tui test-binary
```

**Expected:**
- Binary runs without errors
- Shows TUI interface
- No missing module errors

**If fails:**
- Check for native module errors
- May need pkg assets configuration (next step)

---

### Step 3.5: Configure Native Module Bundling

**Files to create:** `pkg-config.json`

**Content:**
```json
{
  "name": "retro-tui",
  "version": "1.0.0",
  "bin": "tui/index.jsx",
  "pkg": {
    "targets": [
      "node18-macos-arm64"
    ],
    "assets": [
      "node_modules/@roamhq/wrtc/build/**/*"
    ],
    "outputPath": "dist/binaries"
  }
}
```

**Update package.json:**
```json
{
  "scripts": {
    "build:tui-binary": "pkg . --config pkg-config.json --compress GZip"
  }
}
```

**Validation:**
```bash
rm -rf dist/binaries  # Clean build
npm run build:tui-binary
```

---

### Step 3.6: Test Binary with Network Sync

**Action:**
```bash
# Terminal 1: Run binary
./dist/binaries/retro-tui test-binary-sync

# Terminal 2: Run browser or npm version
npm run tui test-binary-sync
```

**Expected:**
- Binary syncs with other clients
- Same behavior as npm version
- No performance degradation

**Success criteria:**
- All tests from Step 2.3 pass with binary
- No missing dependency errors
- WebRTC connections work

---

### Step 3.7: Add Multi-Platform Targets

**Files to modify:** `pkg-config.json`

**Change:**
```json
{
  "pkg": {
    "targets": [
      "node18-macos-arm64",
      "node18-macos-x64",
      "node18-linux-x64",
      "node18-win-x64"
    ]
  }
}
```

**Note:** Only test platforms you have access to locally

**Validation:**
```bash
npm run build:tui-binary
ls -lh dist/binaries/
```

**Expected:**
- 4 binaries created (or 1 per available platform)
- Each named correctly
- Reasonable file sizes

---

### Step 3.8: Platform-Specific Testing

**Test on each available platform:**

**macOS (your platform):**
```bash
./dist/binaries/retro-tui-macos-arm64 test-platform
```

**Linux (if available via VM/Docker):**
```bash
docker run -it --rm -v $(pwd)/dist:/dist node:18 /dist/binaries/retro-tui-linux-x64 test-platform
```

**Windows (if available):**
```cmd
dist\binaries\retro-tui-win-x64.exe test-platform
```

**Checkpoint:** `git add -A && git commit -m "feat: add binary packaging with pkg"`

---

## Phase 4: GitHub Actions CI/CD

### Step 4.1: Create Basic Workflow

**Files to create:** `.github/workflows/build-tui.yml`

**Content (minimal):**
```yaml
name: Build TUI Binaries

on:
  workflow_dispatch:  # Manual trigger only for now

jobs:
  build:
    runs-on: macos-latest

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
          name: retro-tui-test
          path: dist/binaries/*
```

**Validation:**
1. Commit and push to GitHub
2. Go to Actions tab
3. Manually trigger workflow
4. Check if build succeeds

**Expected:**
- Workflow runs successfully
- Artifact uploaded
- Can download and test artifact

---

### Step 4.2: Add Multi-Platform Matrix

**Files to modify:** `.github/workflows/build-tui.yml`

**Change:** Add matrix strategy (see full workflow in tui.md)

**Validation:**
1. Push to GitHub
2. Trigger workflow
3. Check all 4 platform jobs

**Expected:**
- All platforms build successfully
- 4 separate artifacts created

---

### Step 4.3: Add Release Creation

**Files to modify:** `.github/workflows/build-tui.yml`

**Change:** Add release job (see tui.md)

**Validation:**
```bash
# Create a test tag
git tag v0.0.1-test
git push origin v0.0.1-test
```

**Expected:**
- Workflow triggers automatically
- Release created on GitHub
- All 4 binaries attached to release

**Test release:**
```bash
# Download one binary
curl -L https://github.com/YOUR_USERNAME/retro/releases/download/v0.0.1-test/retro-tui-macos-arm64 -o /tmp/retro-test
chmod +x /tmp/retro-test
/tmp/retro-test test-release
```

**Checkpoint:** `git add -A && git commit -m "ci: add GitHub Actions workflow for TUI binaries"`

---

## Phase 5: Distribution Script

### Step 5.1: Create Install Script

**Files to create:** `dist/install.sh`

**Content:** (see full script in tui.md)

**Validation:**
```bash
chmod +x dist/install.sh
# Don't run yet - just verify syntax
bash -n dist/install.sh
```

**Expected:** No syntax errors

---

### Step 5.2: Test Install Script Locally

**Action:**
```bash
# Test with local files (modify script temporarily to use local path)
sudo dist/install.sh
```

**Validation:**
```bash
which retro-tui
retro-tui --version
retro-tui test-install
```

**Expected:**
- Installs to /usr/local/bin
- Executable is runnable
- Works from any directory

---

### Step 5.3: Test Remote Install

**Prerequisites:**
- Push install.sh to GitHub Pages
- Have a real release created

**Action:**
```bash
# Test the actual curl install
curl -fsSL https://YOUR_USERNAME.github.io/retro/install.sh | bash
```

**Expected:**
- Detects platform correctly
- Downloads appropriate binary
- Installs successfully
- Binary works

**Checkpoint:** `git add -A && git commit -m "feat: add one-line install script"`

---

## Phase 6: Documentation

### Step 6.1: Update README

**Files to modify:** `README.md`

**Add sections:**
- Installation instructions (browser + terminal)
- Usage examples
- Features comparison
- Troubleshooting

**Validation:**
- Preview README locally
- Check all links work
- Verify commands are copy-paste ready

---

### Step 6.2: Create Release Notes Template

**Files to create:** `.github/RELEASE_TEMPLATE.md`

**Include:**
- What's new
- Installation instructions
- Platform support
- Known issues

---

### Step 6.3: Add CONTRIBUTING.md

**Files to create:** `CONTRIBUTING.md`

**Include:**
- How to build locally
- How to test changes
- How to test binary builds
- Platform requirements

**Checkpoint:** `git add -A && git commit -m "docs: add installation and contribution guides"`

---

## Final Validation Checklist

Before considering the project complete:

- [ ] Browser-only mode still works (no regression)
- [ ] Browser ↔ TUI sync works reliably
- [ ] TUI ↔ TUI sync works reliably
- [ ] 3+ clients can sync simultaneously
- [ ] Binary works on macOS (ARM + Intel)
- [ ] Binary works on Linux
- [ ] Binary works on Windows
- [ ] Install script detects platform correctly
- [ ] Binary size < 50MB per platform
- [ ] No native module errors
- [ ] No memory leaks during extended use
- [ ] Graceful handling of network disconnections
- [ ] Room names with special characters work
- [ ] Can rejoin room after closing
- [ ] Cards persist in browser (IndexedDB)
- [ ] GitHub release workflow works
- [ ] Documentation is accurate
- [ ] curl install works on fresh machine

---

## Rollback Strategy

**If Phase 2 fails:**
```bash
git checkout src/core/platform/node.js
npm install werift
npm uninstall @roamhq/wrtc
```

**If Phase 3 fails:**
```bash
npm uninstall @yao-pkg/pkg
rm -rf dist/binaries pkg-config.json
# Remove script from package.json
```

**If Phase 4 fails:**
```bash
# Disable workflow
git rm .github/workflows/build-tui.yml
git commit -m "disable broken workflow"
```

**Nuclear option (start over):**
```bash
git checkout main
git branch -D tui
git checkout -b tui-v2
# Start from Phase 2 again
```

---

## Performance Benchmarks

Track these metrics at each phase:

**Binary size:**
- Phase 3.3: ___ MB
- Phase 3.5: ___ MB
- Phase 3.7: ___ MB (per platform)

**Sync latency:**
- Browser ↔ Browser: ~100-500ms (baseline)
- Browser ↔ TUI (npm): ___ ms
- Browser ↔ TUI (binary): ___ ms

**Build time:**
- Phase 3.3 (single platform): ___ seconds
- Phase 3.7 (all platforms): ___ seconds
- Phase 4.2 (CI/CD): ___ minutes

---

## Known Issues & Workarounds

**Issue:** wrtc requires compilation on some platforms
**Workaround:** Use prebuilt binaries from @roamhq/wrtc

**Issue:** pkg may not bundle native modules correctly
**Workaround:** Use assets configuration in pkg-config.json

**Issue:** Install script needs sudo on macOS/Linux
**Workaround:** Provide alternative install to ~/bin for non-sudo users

**Issue:** Windows binary might trigger antivirus warnings
**Workaround:** Sign binary (future enhancement) or document exception process

---

## Success Metrics

**Technical:**
- Sync reliability: >99% message delivery
- Connection time: <5 seconds to first peer
- Memory usage: <100MB for TUI client
- CPU usage: <5% while idle

**User Experience:**
- Install time: <30 seconds (after download)
- Time to first sync: <10 seconds
- Commands learned: 1 (just `retro-tui room-name`)

**Distribution:**
- Binary download size: 30-50MB
- GitHub Release downloads: Track monthly
- Install script success rate: >95%

---

## Next Steps After Completion

**Future Enhancements:**
1. Offline mode for TUI (local storage)
2. Binary signing for security
3. Auto-update mechanism
4. Performance optimizations
5. Additional signaling servers
6. Custom themes for TUI
7. Export/import functionality
8. Admin controls in TUI

**Potential Issues to Monitor:**
1. WebRTC compatibility changes
2. pkg maintenance status
3. wrtc prebuilt availability
4. Cloudflare signaling server reliability
5. GitHub Pages hosting limits
