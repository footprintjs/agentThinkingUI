import js from "@eslint/js";
import globals from "globals";

// Cross-file symbols. This library is intentionally no-module: each browser
// script shares globals (components on `window`, helpers as top-level decls),
// so ESLint needs them declared to resolve references.
const PROJECT_GLOBALS = {
  React: "readonly",
  ReactDOM: "readonly",
  // library
  Stage: "readonly", Inspector: "readonly", Notepad: "readonly", Timeline: "readonly",
  ToolIcon: "readonly", usePlayback: "readonly",
  AgentTheme: "readonly", AgentThemeContext: "readonly",
  AgentThinkingUI: "readonly", AgentFootprint: "readonly",
  arcLayout: "readonly", AF_LAYOUT: "readonly", AF_DWELL: "readonly",
  AGENT_THEME: "writable", AGENT_LABELS: "writable", AGENT_DISPLAY_NAME: "writable",
  AGENT_ICONS: "writable", AGENT_THEME_RESOLVED: "writable",
  AGENT_TRACE: "writable", AGENT_TRACES: "writable",
  // demo chrome
  DemoSettings: "readonly", Gear: "readonly", GhMark: "readonly",
  useTweaks: "readonly", TweaksPanel: "readonly", TweakSection: "readonly",
  TweakRow: "readonly", TweakSlider: "readonly", TweakToggle: "readonly",
  TweakRadio: "readonly", TweakSelect: "readonly", TweakText: "readonly",
};

export default [
  { ignores: ["node_modules/**", "coverage/**"] },

  // the library + demo: browser scripts (no modules)
  {
    files: ["src/**/*.{js,jsx}", "demo/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...PROJECT_GLOBALS },
    },
    rules: {
      ...js.configs.recommended.rules,
      // components are used inside JSX, which base ESLint doesn't count as a
      // "use" — so ignore unused for Capitalized names (and underscore-prefixed).
      "no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_|^." }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // each browser script defines globals other scripts consume — the
      // cross-file pattern legitimately "redeclares" the shared name.
      "no-redeclare": "off",
    },
  },

  // tooling: real ES modules on Node
  {
    files: ["test/**/*.mjs", "**/*.config.mjs", "docs/assets/*.mjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, React: "readonly" },
    },
  },
];
