# RetroBoard TUI - Detailed Implementation Plan

## Overview

This plan breaks down the TUI implementation into small, testable increments with validation at each step. Each step can be verified independently before moving forward.

## Status Summary

- **Phase 1:** Completed (Project setup)
- **Phase 2:** Completed (Wrtc integration & Shared Store)
- **Phase 3:** Partially Completed (Binary build scripts exist, runtime issues persist)
- **Phase 4:** Completed (CI/CD Workflow)
- **Phase 5:** Completed (Install script)

---

## Detailed Progress

### Phase 2: Enable wrtc Integration (Completed)

- **Platform Abstraction:** Created `src/core/platform/node.js` and `browser.js`.
- **Shared Store:** Refactored logic into `src/core/createStore.js`.
- **Browser Integration:** Updated `src/Store.js` to use the shared core.
- **TUI App:** Implemented `tui/index.jsx` using `ink` and the shared store.

### Phase 3: Create Standalone Binary (In Progress)

- **Build Tools:** Installed `esbuild` and `pkg`.
- **Bundling:** Configured `esbuild` to create a single bundle (`tui-bundle.mjs`).
- **Packaging:** Configured `pkg` in `package.json`.
- **Current Status:**
    - `npm run build:tui-binary` successfully creates the binary.
    - **Known Issue:** Runtime error `MODULE_NOT_FOUND` when executing the binary due to ESM/Snapshot resolution in `pkg`.
    - **Workaround:** Run source directly via `npm run tui <room>`.

---

## Validated Features

- ✅ **Browser App:** Starts and functions correctly with refactored store.
- ✅ **TUI App:** Starts, parses arguments, connects to signaling server.
- ✅ **Signaling:** Both clients connect to `wss://signaling.yjs.dev` (or configured server).
- ⚠️ **Synchronization:** Validated connection to signaling, but peer-to-peer data exchange in local Node.js environment requires further network troubleshooting (likely NAT/ICE related).

---

## Next Steps

1.  **Fix Binary Runtime:** Investigate `pkg` configuration for ESM bundles or switch to full CJS transcoding.
2.  **Debug Network Sync:** Test with a local signaling server to rule out public server latency/NAT issues.
3.  **Release:** Tag version to trigger GitHub Actions build.