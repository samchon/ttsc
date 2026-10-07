import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { acquirePluginBuildLock } from "../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { buildSourcePlugin } from "../../../../packages/ttsc/src/plugin/internal/source/buildSourcePlugin";
import { computeCacheKey } from "../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";
import { inspectPluginBuildLock } from "../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";
import { prunePluginCacheRoot } from "../../../../packages/ttsc/src/plugin/internal/source/prunePluginCacheRoot";
import { releasePluginBuildLock } from "../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { resolvePluginCacheRoot } from "../../../../packages/ttsc/src/plugin/internal/source/resolvePluginCacheRoot";
import { waitForPluginBinary } from "../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary";

export {
  buildSourcePlugin,
  SourceBuildCacheLayout,
  resolvePluginCacheRoot,
  acquirePluginBuildLock,
  assert,
  computeCacheKey,
  fs,
  inspectPluginBuildLock,
  os,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
  waitForPluginBinary,
};
