import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a native plugin diagnostic rejects the transform with its message.
 *
 * A plugin that rejects a source reports a diagnostic through the host. The
 * adapter must surface it as a rejection carrying the diagnostic text, or the
 * bundler would show a generic failure that hides what the plugin said.
 *
 * 1. Create a project whose source exports a plain string where the plugin expects
 *    `goUpper(...)`.
 * 2. Transform the entry.
 * 3. Assert it rejects with the plugin's diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification Plain-string export rejected with expected export const value = goUpper diagnostic.
 * @evidence contracts/testing.md#independent-expectations Source deliberately violates fixture plugin input contract; literal diagnostic identifies native verdict transport.
 * @evidence contracts/testing.md#distinguishing-cases Actual native plugin rejection versus successful goUpper inputs in other cases.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_reports_native_transform_diagnostics is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for actual native plugin rejection versus successful goUpper inputs in other cases. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Plain-string export rejected with expected export const value = goUpper diagnostic. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_reports_native_transform_diagnostics(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    source: 'export const value: string = "plain";\n',
  });

  await assert.rejects(
    () =>
      transformTtsc(
        TestUnpluginProject.mainFile(root),
        TestUnpluginProject.mainSource(root),
        resolveOptions(),
      ),
    /expected export const value = goUpper/,
  );
}
