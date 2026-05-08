import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { workspaceRoot } from "@ttsc/testing";

const requireFromTest = createRequire(import.meta.url);
// JS-side tests for the @ttsc/lint plugin descriptor.
//
// These checks pin the contract between the JS plugin descriptor and
// the ttsc plugin host. The rule corpus is exercised end-to-end by
// `cases.test.cjs`; engine + config sanity by `plugin/`.

const __dirname = import.meta.dirname;

const lintPkgDir = path.join(workspaceRoot, "packages", "lint");
const pluginPath = path.join(lintPkgDir, "lib", "index.js");
const goSourceDir = lintPkgDir;
const goPluginDir = path.join(lintPkgDir, "plugin");

function loadFactory() {
  const mod = requireFromTest(pluginPath);
  return mod.createTtscPlugin ?? mod.default ?? mod;
}

function factoryContext(plugin) {
  return {
    binary: "",
    cwd: process.cwd(),
    plugin,
    projectRoot: lintPkgDir,
    tsconfig: path.join(lintPkgDir, "tsconfig.json"),
  };
}

export {
  __dirname,
  assert,
  createRequire,
  factoryContext,
  fs,
  goPluginDir,
  goSourceDir,
  lintPkgDir,
  loadFactory,
  path,
  pluginPath,
  requireFromTest,
};
