import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a plugin installed as a package under `node_modules` is discovered
 * and applied without an explicit plugin list.
 *
 * Ttsc discovers plugins that packages declare, the same way the command-line
 * compiler does. An adapter that honored only explicit lists would compile such
 * a project untransformed.
 *
 * 1. Create a project with no configured plugins.
 * 2. Install the fixture plugin as a package.
 * 3. Transform the entry and assert the output is transformed.
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
