import { defineConfig } from "vitest/config";

// The library ships as plain browser scripts that attach to `window`, so tests
// run in jsdom and import the file under test — it wires itself onto `window`,
// exactly as in the browser. The JSX views are compiled with the classic
// factory against the global React (same as the browser's Babel standalone).
// (Dev-only tooling; the published package still has no build step.)
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.mjs"],
    setupFiles: ["test/setup.mjs"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"], // the library only — demo/ is excluded
      exclude: ["src/index.jsx", "src/global.jsx"], // bundler entry glue
      reporter: ["text", "text-summary", "lcov", "json-summary"],
    },
  },
});
