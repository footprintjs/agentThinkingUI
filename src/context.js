import React from "react";

// The resolved theme/labels/icons travel down from <AgentThinkingUI> through this
// context. A single shared instance so every view reads the same provider.
export const AgentThemeContext = React.createContext(null);
