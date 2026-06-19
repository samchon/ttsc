// @ts-check
"use strict";

const path = require("node:path");

// Keys from the tsconfig plugin entry that @ttsc/strip accepts. All other keys
// are rejected so that stale inline options (calls, statements) surface as a
// clear error rather than silently falling back to defaults.
const ALLOWED_TSCONFIG_KEYS = new Set([
  "configFile",
  "enabled",
  "name",
  "stage",
  "transform",
]);

module.exports = function createTtscStrip(context) {
  const plugin =
    context && typeof context === "object" && context.plugin != null
      ? context.plugin
      : {};
  for (const key of Object.keys(plugin)) {
    if (!ALLOWED_TSCONFIG_KEYS.has(key)) {
      throw new Error(
        `@ttsc/strip: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}; ` +
          `strip configuration must be supplied via a strip.config.* file ` +
          `(use the "configFile" key to point at a custom path)`,
      );
    }
  }
  return {
    name: "@ttsc/strip",
    // `context.dirname` is this descriptor's own directory in every load mode —
    // the ESM-safe replacement for `__dirname`.
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
};
