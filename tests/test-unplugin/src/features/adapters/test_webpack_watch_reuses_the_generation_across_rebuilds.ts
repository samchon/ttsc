import { assertWebpackWatchReusesTheGenerationAcrossRebuilds } from "../../internal/adapter-webpack";

/**
 * Verifies a real webpack watch rebuild reuses the transform generation.
 *
 * The end-to-end half of samchon/ttsc#1300, and the case samchon/ttsc#1302 asks
 * for: the core scenarios drive the pass boundary directly, while this one
 * proves the wiring from a host's own rebuild signal to it. unplugin maps
 * `buildStart` onto `compiler.hooks.make`, which fires once per compilation, so
 * a watch session opens a pass per rebuild — and the per-pass clear turned each
 * of those into a whole-project transform.
 *
 * 1. Watch-build a project whose entry reaches a sibling only through the graph.
 * 2. Rewrite that sibling with its own bytes, moving only its timestamp.
 * 3. Assert the resulting rebuild ran no second whole-project compile.
 */
export const test_webpack_watch_reuses_the_generation_across_rebuilds =
  async () => {
    await assertWebpackWatchReusesTheGenerationAcrossRebuilds();
  };
