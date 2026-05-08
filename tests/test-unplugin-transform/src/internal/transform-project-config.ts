import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProject,
  mainFile,
  mainSource,
} from "@ttsc/testing/unplugin/project";
import { loadUnpluginApi } from "@ttsc/testing/unplugin/unplugin";

async function assertTransformReadsDiscoveredTsconfig() {
  const { resolveOptions, transformTtsc } = await loadUnpluginApi();
  const root = createProject();
  const result = await transformTtsc(
    mainFile(root),
    mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /export const value = "PLUGIN"/);
  assert.doesNotMatch(result.code, /goUpper/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
}

export {
  assert,
  assertTransformReadsDiscoveredTsconfig,
  createProject,
  fs,
  loadUnpluginApi,
  mainFile,
  mainSource,
  path,
};
