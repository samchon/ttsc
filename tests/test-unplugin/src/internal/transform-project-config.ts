import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TestUnpluginProject } from "@ttsc/testing/unplugin/project";
import { TestUnpluginRuntime } from "@ttsc/testing/unplugin/unplugin";

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
