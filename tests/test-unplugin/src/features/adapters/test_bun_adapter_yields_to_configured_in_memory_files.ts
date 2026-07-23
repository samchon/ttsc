import { assertBunAdapterYieldsToConfiguredInMemoryFiles } from "../../internal/adapter-bun";

/**
 * Verifies Bun build files retain their in-memory loader priority.
 *
 * Bun exposes configured `files` entries as ordinary `file` namespace paths and
 * preserves relative key spellings. Treating those paths as disk inputs either
 * fails for a virtual entry or silently transforms stale disk contents.
 *
 * 1. Configure one relative override and one absolute virtual TypeScript file.
 * 2. Invoke the captured loader with Bun's relative and absolute path spellings.
 * 3. Assert the adapter yields both entries to Bun without reading disk.
 */
export const test_bun_adapter_yields_to_configured_in_memory_files =
  async () => {
    await assertBunAdapterYieldsToConfiguredInMemoryFiles();
  };
