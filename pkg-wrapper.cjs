/**
 * pkg-wrapper.js
 * 
 * This is a CommonJS wrapper for the ESM bundle.
 * pkg starts in CJS mode, so we use a dynamic import to bridge to the ESM code.
 */
async function start() {
  try {
    // In pkg, we need to use the absolute snapshot path or relative path
    await import('./tui-bundle.js');
  } catch (err) {
    console.error('Failed to start RetroBoard TUI:', err);
    process.exit(1);
  }
}

start();
