/**
 * Shared helpers for tests that exercise project-config resolution and plugin
 * loading. Re-exports the internal `readProjectConfig`, `resolveProjectConfig`,
 * and `loadProjectPlugins` functions so feature files can call them directly
 * without encoding package-relative import paths.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../../../packages/ttsc/lib/compiler/internal/project/readProjectConfig.js";
import { resolveProjectConfig } from "../../../../packages/ttsc/lib/compiler/internal/project/resolveProjectConfig.js";
import { loadProjectPlugins } from "../../../../packages/ttsc/lib/plugin/internal/loadProjectPlugins.js";

export {
  assert,
  fs,
  loadProjectPlugins,
  os,
  path,
  readProjectConfig,
  resolveProjectConfig,
};
