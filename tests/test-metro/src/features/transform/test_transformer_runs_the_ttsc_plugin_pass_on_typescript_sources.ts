import { assertRunsTtscPluginPassOnTypeScript } from "../../internal/metro-transform";

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
 */
export const test_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources =
  async () => {
    await assertRunsTtscPluginPassOnTypeScript();
  };
