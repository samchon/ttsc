import { assertBunAdapterYieldsToConfiguredInMemoryFiles } from "../../internal/adapter-bun";

/**
 * Verifies Bun build files retain their in-memory loader priority.
 *
 * Bun exposes configured `files` entries as ordinary `file` namespace paths.
 * Relative keys stay relative while separators may be normalized. Treating
 * those paths as disk inputs either fails or transforms stale disk contents,
 * while path-component-case-only, relative/absolute, and dot-segment variants
 * remain distinct.
 *
 * 1. Configure one relative override and one absolute virtual TypeScript file.
 * 2. Change cwd and invoke Bun's normalized relative and absolute spellings.
 * 3. Exercise Windows drive-case and separator equivalence without collapsing
 *    component case, relative/absolute, or dot-segment identity.
 * 4. Assert equivalent entries yield while Bun-distinct spellings do not.
 */
export const test_bun_adapter_yields_to_configured_in_memory_files =
  async () => {
    await assertBunAdapterYieldsToConfiguredInMemoryFiles();
  };
