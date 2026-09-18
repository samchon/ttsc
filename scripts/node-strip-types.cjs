"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

/**
 * Loader flags for repository tools that deliberately execute TypeScript
 * modules inside packages whose published runtime remains CommonJS.
 *
 * The extensionless loader is part of the contract: a tool imports the same
 * source modules the package compiles, and those modules import each other
 * without extensions (one declaration per file), which Node's own resolver
 * refuses.
 */
const STRIP_TYPES_NODE_ARGS = Object.freeze([
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  "--experimental-strip-types",
  "--import",
  pathToFileURL(path.join(__dirname, "register-extensionless-ts-loader.mjs"))
    .href,
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
