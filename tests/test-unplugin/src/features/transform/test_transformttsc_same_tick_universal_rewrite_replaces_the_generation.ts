import { assertSameTickUniversalRewriteReplacesTheGeneration } from "../../internal/transform-project-cache";

/**
 * Verifies a same-tick, same-length rewrite of a universal input replaces the
 * generation.
 *
 * Pins samchon/ttsc#1227 on the universal descriptor/config manifest, the more
 * exposed half in practice: its inputs are `tsconfig.json`, plugin descriptors,
 * and package manifests, which tooling rewrites in place. Before the fix
 * `captureUniversalHostInputValidation` recorded a signature for a stamp whose
 * tick the filesystem's clock had not provably left, so
 * `matchesUniversalHostInputEntries` skipped the rewritten bytes on every later
 * delivery.
 *
 * 1. Deliver a project through cache-owned operations that pin every stamp to one
 *    tick.
 * 2. Rewrite `package.json` with its keys reordered — same length, same tick.
 * 3. Assert the next delivery replaces the generation and recompiles once.
 */
export const test_transformttsc_same_tick_universal_rewrite_replaces_the_generation =
  async () => {
    await assertSameTickUniversalRewriteReplacesTheGeneration();
  };
