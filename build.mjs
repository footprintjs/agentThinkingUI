/* Builds dist/ from the ESM source — two bundles + the stylesheet:
 *   dist/agentthinkingui.js      ESM, React externalized   → `import` for app/bundler users
 *   dist/agentthinkingui.umd.js  IIFE, React from window    → <script>/CDN drop-in (sets window.*)
 *   dist/agentthinkingui.css     the stylesheet
 * Run:  npm run build
 */
import esbuild from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("src/styles.css", "dist/agentthinkingui.css");

// for the IIFE/CDN bundle, map bare react / react-dom to the page globals
const reactGlobals = {
  name: "react-globals",
  setup(b) {
    b.onResolve({ filter: /^react(-dom(\/client)?)?$/ }, (a) => ({ path: a.path, namespace: "rg" }));
    b.onLoad({ filter: /.*/, namespace: "rg" }, (a) => ({
      contents: `module.exports = window.${a.path.startsWith("react-dom") ? "ReactDOM" : "React"};`,
    }));
  },
};

const base = { bundle: true, jsx: "transform", minify: true, sourcemap: true, logLevel: "info" };

await esbuild.build({
  ...base,
  entryPoints: ["src/index.jsx"],
  format: "esm",
  outfile: "dist/agentthinkingui.js",
  external: ["react", "react-dom"], // peer deps for bundler users
});

await esbuild.build({
  ...base,
  entryPoints: ["src/global.jsx"],
  format: "iife",
  outfile: "dist/agentthinkingui.umd.js",
  plugins: [reactGlobals],
});

console.log("✓ built dist/");
