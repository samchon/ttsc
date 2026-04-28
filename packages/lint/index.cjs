// @ts-check
"use strict";

const path = require("node:path");

/**
 * `@ttsc/lint` plugin descriptor.
 *
 * The `rules` field on the tsconfig plugin entry flows straight through to
 * the native binary via `--plugins-json`. Severity values follow the ESLint
 * convention (`"off"` | `"warn"` | `"error"`, also `0` | `1` | `2`).
 *
 * @param {Record<string, unknown>} _config
 * @returns {{ name: string; native: { mode: string; source: { dir: string }; contractVersion: 1; capabilities: string[] } }}
 */
module.exports = function createTtscLint(_config) {
  return {
    name: "@ttsc/lint",
    native: {
      mode: "ttsc-lint",
      source: {
        dir: path.resolve(__dirname, "go-plugin"),
      },
      contractVersion: 1,
      capabilities: ["check", "build", "transform"],
    },
  };
};
