"use strict";

const childProcess = require("node:child_process");

/**
 * Loader flags for repository tools that deliberately execute TypeScript
 * modules inside packages whose published runtime remains CommonJS.
 */
const STRIP_TYPES_NODE_ARGS = Object.freeze([
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  "--experimental-strip-types",
]);

function runStripTypes(args, options = {}) {
  return childProcess.spawnSync(
    process.execPath,
    [...STRIP_TYPES_NODE_ARGS, ...args],
    {
      stdio: "inherit",
      ...options,
    },
  );
}

if (require.main === module) {
  const result = runStripTypes(process.argv.slice(2));
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

module.exports = { runStripTypes, STRIP_TYPES_NODE_ARGS };
