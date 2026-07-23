import { assertViteServeValidatesFirstUseAfterStartup } from "../../internal/adapter-vite";

/**
 * Verifies Vite serve retains persistent cache validation after startup.
 *
 * Its `buildStart` callback is not replayed for every HMR edit. Treating that
 * one callback as a complete build boundary lets a later first-use module
 * escape validation against an earlier changed input.
 */
export const test_vite_serve_validates_first_use_after_startup = async () => {
  await assertViteServeValidatesFirstUseAfterStartup();
};
