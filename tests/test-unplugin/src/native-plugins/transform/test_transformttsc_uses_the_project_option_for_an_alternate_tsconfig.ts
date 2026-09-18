import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { writeUnpluginProject } from "../../internal/transform-project-option/writeUnpluginProject";

/**
 * Verifies an explicit absolute `project` path is used instead of discovering
 * `tsconfig.json`.
 *
 * A bundler often needs its own tsconfig beside the editor's. The explicit
 * option must win over discovery, or the adapter would compile with the wrong
 * plugins.
 *
 * 1. Write an alternate tsconfig that declares the fixture plugin, beside a
 *    default one that declares none.
 * 2. Transform with `project` pointing at the alternate config.
 * 3. Assert the output is transformed.
 */
export async function test_transformttsc_uses_the_project_option_for_an_alternate_tsconfig(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      project: path.join(root, "tsconfig.unplugin.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
