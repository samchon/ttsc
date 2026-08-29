import { assertTurbopackLoaderPassesThroughNonSourceIds } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader applies the shared transform-target filter.
 *
 * The samchon/ttsc#1305 defect: the loader re-implemented two of
 * `isTransformTarget`'s four conditions while its docstring, the README and the
 * website all claimed parity, so a rule glob wider than `*.ts`/`*.tsx` routed
 * JavaScript and virtual ids into the whole-project transform every other
 * adapter excludes, where the program has no entry for them and the delivery
 * fails. These are exactly the rows the two filters disagreed on.
 *
 * 1. Run the loader over `.js`, `.mjs`, `.cjs` and `.jsx` resource paths.
 * 2. Run it over an id carrying the virtual-module NUL sentinel.
 * 3. Assert every one of them comes back byte-identical and uncompiled.
 */
export const test_turbopack_loader_passes_through_non_source_ids = async () => {
  await assertTurbopackLoaderPassesThroughNonSourceIds();
};
