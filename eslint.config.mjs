import js from "@eslint/js";
import globals from "globals";

// The demo still consumes the library through the UMD bundle's window globals
// (and Babel-standalone runs each <script> in global scope), so its cross-file
// symbols must be declared. The library itself is now real ES modules.
const DEMO_GLOBALS = {
  React: "readonly", ReactDOM: "readonly",
  AgentThinkingUI: "readonly", AgentFootprint: "readonly", AgentTheme: "readonly",
  Stage: "readonly", Inspector: "readonly", Notepad: "readonly", Timeline: "readonly",
  ToolIcon: "readonly", usePlayback: "readonly", arcLayout: "readonly", AF_LAYOUT: "readonly",
  AF_DWELL: "readonly", AgentThemeContext: "readonly",
  DemoSettings: "readonly", Gear: "readonly", GhMark: "readonly",
  useTweaks: "readonly", TweaksPanel: "readonly", TweakSection: "readonly", TweakRow: "readonly",
  TweakSlider: "readonly", TweakToggle: "readonly", TweakRadio: "readonly", TweakSelect: "readonly", TweakText: "readonly",
  AGENT_TRACE: "writable", AGENT_TRACES: "writable",
};

const sharedRules = {
  "no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_|^." }],
  "no-empty": ["warn", { allowEmptyCatch: true }],
};

export default [
  { ignores: ["node_modules/**", "coverage/**", "dist/**"] },

  // the library — real ES modules (React + siblings are imported)
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules },
  },

  // the demo — script-tag globals (UMD bundle + Babel-standalone)
  {
    files: ["demo/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...DEMO_GLOBALS },
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules, "no-redeclare": "off" },
  },

  // tooling — Node ES modules
  {
    files: ["test/**/*.mjs", "*.mjs", "docs/assets/*.mjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser, React: "readonly" },
    },
  },
];
