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
 *
 * @evidence contracts/testing.md#behavioral-verification Directory named src/tsconfig.json is skipped; result contains export value PLUGIN without goUpper and no dist directory appears.
 * @evidence contracts/testing.md#independent-expectations Authored plugin rewrite fixes literal output; single-file transform contract forbids build emission.
 * @evidence contracts/testing.md#distinguishing-cases Directory-shaped config candidate versus real ancestor config.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_reads_plugins_from_the_discovered_tsconfig is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built public transformation invokes actual config discovery/overlay and native compiler or fixture plugin. The assertions establish that the selected config/alias reaches that producer, beyond portable option calculations.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API serve this entry's transformations; related repeats reuse configuration/artifact setup. Changed source/options need separate producer calls only for the distinctions above. Portable option policy is not claimed as a separate native boundary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Directory named src/tsconfig.json is skipped; result contains export value PLUGIN without goUpper and no dist directory appears. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
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
