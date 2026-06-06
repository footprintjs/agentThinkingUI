// Test harness for the no-module library: expose React as the global the scripts
// expect, stub the browser bits jsdom lacks, then load the scripts in order so
// they wire themselves onto `window` exactly as they do in the browser.
import React from "react";

globalThis.React = React;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}

// loaded after the globals above are set (dynamic import = runs post-assignment)
await import("../src/theme.js");
await import("../src/layout.js");
await import("../src/playback.js");
await import("../src/stage.jsx");
await import("../src/inspector.jsx");
await import("../src/timeline.jsx");
await import("../src/footprint.jsx");
