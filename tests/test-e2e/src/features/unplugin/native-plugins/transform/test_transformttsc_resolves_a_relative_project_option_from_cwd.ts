import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { writeUnpluginProject } from "../../../../internal/unplugin/internal/transform-project-option/writeUnpluginProject";

/**
 * Verifies a relative `project` option resolves against the working directory,
 * not the transformed file.
 *
 * `resolveOptions({ project })` follows the command-line compiler's convention:
 * a relative project path is relative to where the tool runs. Resolving it
 * against the module would pick a different config for every directory.
 *
 * 1. Write an alternate tsconfig at the project root.
 * 2. Change the working directory to the root and transform with `project:
 *    "tsconfig.unplugin.json"`.
 * 3. Assert the output is transformed, then restore the working directory.
 *
 * @evidence contracts/testing.md#behavioral-verification With cwd set to fixture root, relative alternate tsconfig delivers PLUGIN despite default config with no plugins.
 * @evidence contracts/testing.md#independent-expectations Alternate authored config has plugin while default does not; literal output distinguishes config selection.
 * @evidence contracts/testing.md#distinguishing-cases Relative project path at cwd versus transformed module directory.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_resolves_a_relative_project_option_from_cwd is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation invokes actual config discovery/overlay and native compiler or fixture plugin. The assertions establish that the selected config/alias reaches that producer, beyond portable option calculations.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API serve this entry's transformations; related repeats reuse configuration/artifact setup. Changed source/options need separate producer calls only for the distinctions above. Portable option policy is not claimed as a separate native boundary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. cwd is restored in finally; tracked roots end at process exit. No per-case explicit transform-cache teardown is asserted.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: With cwd set to fixture root, relative alternate tsconfig delivers PLUGIN despite default config with no plugins. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_resolves_a_relative_project_option_from_cwd(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions({
        project: "tsconfig.unplugin.json",
      }),
    );

    assert.ok(result);
    assert.match(result.code, /"PLUGIN"/);
  } finally {
    process.chdir(cwd);
  }
}
