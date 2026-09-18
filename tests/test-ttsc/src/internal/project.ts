/**
 * Shared helpers for tests that exercise project-config resolution and plugin
 * loading. Re-exports the internal project resolvers and `loadProjectPlugins`
 * so feature files can call them directly without encoding package-relative
 * import paths.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../../../packages/ttsc/lib/compiler/internal/project/readProjectConfig.js";
import { resolveProjectConfig } from "../../../../packages/ttsc/lib/compiler/internal/project/resolveProjectConfig.js";
import { resolveProjectIdentity } from "../../../../packages/ttsc/lib/compiler/internal/project/resolveProjectIdentity.js";
import { javascriptRuntimeCapabilities } from "../../../../packages/ttsc/lib/internal/javascriptRuntimeCapabilities.js";
import { resolveNodeBinary } from "../../../../packages/ttsc/lib/internal/resolveNodeBinary.js";
import { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "../../../../packages/ttsc/lib/plugin/internal/load/COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE.js";
import { loadProjectPlugins } from "../../../../packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js";

export {
  assert,
  COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE,
  fs,
  javascriptRuntimeCapabilities,
  loadProjectPlugins,
  os,
  path,
  readProjectConfig,
  resolveNodeBinary,
  resolveProjectConfig,
  resolveProjectIdentity,
};
