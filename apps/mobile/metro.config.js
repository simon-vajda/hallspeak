// getDefaultConfig has configured Metro for monorepos since SDK 52, and SDK 54+
// resolves pnpm's isolated linking natively, so no workspace-specific wiring is needed.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
