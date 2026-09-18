import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies discovery skips a directory named `tsconfig.json` and applies the
 * nearest real config's plugins.
 *
 * Discovery walks up from the module. A directory spelled `tsconfig.json` is
 * not a config, so accepting it would stop the walk at nothing. The transform
 * also runs in single-file mode and must not emit a build.
 *
 * 1. Create a directory named `tsconfig.json` beside the entry module.
 * 2. Transform the entry.
 * 3. Assert the ancestor config's plugin applied and no `dist` directory was
 *    created.
 */
export async function test_transformttsc_reads_plugins_from_the_discovered_tsconfig(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  fs.mkdirSync(
    path.join(
      path.dirname(TestUnpluginProject.mainFile(root)),
      "tsconfig.json",
    ),
  );
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
