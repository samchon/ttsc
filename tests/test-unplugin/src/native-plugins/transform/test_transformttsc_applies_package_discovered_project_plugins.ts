import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that a plugin installed as a workspace package under `node_modules`
 * (written via `writePackagePlugin`) is auto-discovered and applied when no
 * explicit plugin list is provided.
 */
export async function test_transformttsc_applies_package_discovered_project_plugins(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  TestUnpluginProject.writePackagePlugin(root, "fixture-auto");

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
