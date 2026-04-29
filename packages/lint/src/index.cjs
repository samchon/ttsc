// @ts-check
"use strict";

const path = require("node:path");

/**
 * `@ttsc/lint` plugin descriptor.
 *
 * The `rules` field on the tsconfig plugin entry flows straight through to
 * the native binary via `--plugins-json`. Documented severity values are
 * `"off"`, `"warning"`, or `"error"`.
 *
 * @param {Record<string, unknown>} _config
 * @returns {{ name: string; native: { mode: string; source: { dir: string; entry: string }; contractVersion: 1; capabilities: string[] } }}
 */
module.exports = function createTtscLint(_config) {
  return {
    name: "@ttsc/lint",
    native: {
      mode: "ttsc-lint",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["check"],
    },
  };
};
