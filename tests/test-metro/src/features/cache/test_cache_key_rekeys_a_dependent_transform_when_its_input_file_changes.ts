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
 *
 * @evidence contracts/testing.md#behavioral-verification An actual native plugin reads helper.ts and emits PLUGIN:FIRST, then editing only that helper changes the Metro key and emits PLUGIN:SECOND.
 * @evidence contracts/testing.md#independent-expectations The authored helper bytes and literal plugin markers independently require changed downstream output, while key inequality follows dependency invalidation.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged transform entry depends on a mutated in-project helper, distinct from out-of-project observation retention.
 * @evidence contracts/testing.md#execution-ownership This named features export test_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Native plugin dependency output must reach the Metro adapter and its subsequent compile, so direct fingerprint fixtures cannot prove transformed output refresh.
 * @evidence contracts/e2e.md#shared-execution Both observations reuse one project and the suite shared content-addressed plugin source/build cache. The changed helper genuinely requires a new compiler generation; no second installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each fresh worker module belongs to its input state; only helper bytes change between runs and options are restored after each worker. The tracked project/cache owner cleans temporary resources at process exit.
 * @evidence contracts/e2e.md#preserved-coverage The original FIRST/SECOND output markers and changed-key assertion remain in this native boundary; portable key and membership decisions retain source-unit owners.
 */
export const test_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes =
  async () => {
    await assertCacheKeyRekeysWhenTransformInputFileChanges();
  };
