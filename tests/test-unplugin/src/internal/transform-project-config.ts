import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Asserts that `transformTtsc` discovers the nearest `tsconfig.json`, applies
 * the plugins it declares, and does not create a `dist/` directory (single-file
 * mode, not a full build).
 */
async function assertTransformReadsDiscoveredTsconfig() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /export const value = "PLUGIN"/);
  assert.doesNotMatch(result.code, /goUpper/);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
}

export { assertTransformReadsDiscoveredTsconfig };
