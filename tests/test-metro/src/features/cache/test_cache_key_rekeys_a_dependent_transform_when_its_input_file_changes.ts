import { assertCacheKeyRekeysWhenTransformInputFileChanges } from "../../internal/metro-cache";

/**
 * Verifies the two-run acceptance reproduction of samchon/ttsc#721, in-project
 * direction: edit only a file the transform's output depends on, re-run without
 * `--reset-cache`, and the run is re-keyed with the regenerated output.
 *
 * The dependent file's own content never changes, which is exactly the v1
 * staleness class: Metro's per-content key would have replayed the run-1 output
 * forever. Exercises the real native compiler, so it runs where the Go
 * toolchain is present (CI), like the other plugin-pass scenarios.
 *
 * 1. Project whose plugin output embeds `src/helper.ts` content ("first"); run 1
 *    computes the key and transforms `src/main.ts` → `PLUGIN:FIRST`.
 * 2. Edit only `src/helper.ts` to "second".
 * 3. Run 2 (fresh module): the key differs and the transform carries
 *    `PLUGIN:SECOND`.
 */
export const test_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes =
  async () => {
    await assertCacheKeyRekeysWhenTransformInputFileChanges();
  };
