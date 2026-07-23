import { assertBunAdapterYieldsToConfiguredInMemoryFiles } from "../../internal/adapter-bun";

/**
 * Verifies Bun build files retain their in-memory loader priority.
 *
 * Bun exposes configured `files` entries as ordinary absolute `file` namespace
 * paths. Treating those paths as disk inputs either fails for a virtual entry
 * or silently transforms stale disk contents instead of the supplied source.
 *
 * 1. Configure one relative override and one absolute virtual TypeScript file.
 * 2. Invoke the captured bundler loader for both absolute paths.
 * 3. Assert the adapter yields both entries to Bun without reading disk.
 */
export const test_bun_adapter_yields_to_configured_in_memory_files =
  async () => {
    await assertBunAdapterYieldsToConfiguredInMemoryFiles();
  };
