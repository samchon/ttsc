import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { writeUnpluginProject } from "../../../../internal/unplugin/internal/transform-project-option/writeUnpluginProject";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Absolute alternate tsconfig produces PLUGIN while discovered default has no plugins.
 * @evidence contracts/testing.md#independent-expectations Authored alternate-only plugin makes literal output an independent selection oracle.
 * @evidence contracts/testing.md#distinguishing-cases Explicit absolute project wins discovery; relative cwd form is complementary.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_transformttsc_uses_the_project_option_for_an_alternate_tsconfig is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts. Its body owns the assertions above; the path-identity case also retains direct portable helper assertions here.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation joins explicit project-option resolution to native producer configuration, proving the alternate plugin really applies rather than only selecting a string path.
 * @evidence contracts/e2e.md#shared-execution One fixture holds default and alternate config, with one actual transform; shared native fixture artifact is reused without sharing mutable config state.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project and cache identities separate mutable inputs; tracked roots are removed on process exit. Cache-local providers and identity contexts avoid global filesystem patches. There is no finally cache-reset guarantee here; process exit bounds remaining observers.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Absolute alternate tsconfig produces PLUGIN while discovered default has no plugins. No assertion is transferred or removed by these tags; mixed portable helpers and cleanup limits remain explicitly disclosed.
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
