import { assertRunsTtscPluginPassOnTypeScript } from "../../../internal/metro/internal/metro-transform";

/**
 * Verifies the transformer runs the ttsc plugin pass on TypeScript sources.
 *
 * The end-to-end proof that the adapter actually applies ttsc plugins inside a
 * Metro build: the source handed to the upstream transformer must be the
 * plugin-transformed output, not the original. Exercises the real native
 * compiler and a Go source plugin, so it runs in CI (Go toolchain present).
 *
 * 1. Create the shared fixture project whose tsconfig declares the Go plugin.
 * 2. Run the transformer on its TypeScript entrypoint with the fake upstream.
 * 3. Assert the source the upstream received was plugin-transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual native plugin uppercases the TypeScript fixture and forwards ios options and Babel plugin descriptors through the upstream result.
 * @evidence contracts/testing.md#independent-expectations The fixture operation defines the uppercase output marker independently; literal platform and Babel descriptors must survive the supported transform parameter spread.
 * @evidence contracts/testing.md#distinguishing-cases Project-relative filename reaches the real compiler, contrasting source-unit gating/passthrough and sibling parameter preservation.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary The built Metro transformer must connect relative project routing, actual native transform output and upstream delivery.
 * @evidence contracts/e2e.md#shared-execution One default project transform uses the suite shared immutable Go source and plugin cache. Output and sibling parameter assertions share that request and do not install another consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project root anchors src/main.ts, fresh worker options are restored, and the immutable shared producer remains untouched. Tracked project/cache resources end with runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original plugin-output, upstream identity, ios option and Babel plugin-array assertions remain.
 */
export const test_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources =
  async () => {
    await assertRunsTtscPluginPassOnTypeScript();
  };
