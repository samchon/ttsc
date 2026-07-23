import { assertViteServeValidatesFirstUseAfterStartup } from "../../internal/adapter-vite";

/**
 * Verifies Vite serve retains persistent cache validation after startup.
 *
 * Its `buildStart` callback is not replayed for every HMR edit. Treating that
 * one callback as a complete build boundary lets a later first-use module
 * escape validation against an earlier changed input.
 *
 * 1. Start Vite serve and compile an entry that also emits a lazy module.
 * 2. Corrupt the entry after startup, then request the lazy module first.
 * 3. Assert persistent validation rejects the stale initial generation.
 */
export const test_vite_serve_validates_first_use_after_startup = async () => {
  await assertViteServeValidatesFirstUseAfterStartup();
};
