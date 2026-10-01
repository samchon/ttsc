import { assertOutsideProjectFilePassesThrough } from "../../../internal/metro/internal/metro-transform";

/**
 * Verifies a file outside the tsconfig program passes through untransformed.
 *
 * A file the compiled program does not contain is not a build error. The shared
 * `@ttsc/unplugin` core decides that once for every adapter and returns
 * `undefined`, exactly as it does for a module ttsc leaves unchanged, so this
 * transformer hands the original source downstream with no special case of its
 * own. It used to recognise the condition by searching the error text, which is
 * how one product came to hold two different answers to it, with every unplugin
 * adapter failing the build for what this one called non-fatal
 * (samchon/ttsc#1308). Exercises the real native compiler (Go source plugin) →
 * runs in CI.
 *
 * 1. Create the fixture project and a stray `.ts` file outside its `src/`.
 * 2. Transform the stray file (relative path + projectRoot).
 * 3. Assert the upstream received the original, untransformed source.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual out-of-program native transform preserves source, records exact external config-selection candidates and taint, then a config inclusion edit changes the guarded key.
 * @evidence contracts/testing.md#independent-expectations The authored stray file belongs to a separate config that initially excludes scripts; literal original source and selection paths independently establish pass-through and future inclusion.
 * @evidence contracts/testing.md#distinguishing-cases Out-of-program pass-through contrasts true plugin failure; later include mutation exercises recovery from that earlier admission decision.
 * @evidence contracts/testing.md#execution-ownership This named features export test_transformer_passes_files_outside_the_project_through executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Only actual compiler program membership can establish this module was excluded while the adapter retains its project-selection dependency guards.
 * @evidence contracts/e2e.md#shared-execution The same external project and bare Metro root serve pass-through and later key checks using the suite native producer cache. Including scripts requires a fresh fingerprint; no unnecessary second native transform is used.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Two separately tracked fixture roots prevent accidentally admitting the stray file into the Metro program. Only the external config include changes; run IDs, worker compaction and option restoration maintain explicit generation ownership.
 * @evidence contracts/e2e.md#preserved-coverage Original source equality, taint, every external selection candidate, fresh-epoch inequality and config-inclusion invalidation remain.
 */
export const test_transformer_passes_files_outside_the_project_through =
  async () => {
    await assertOutsideProjectFilePassesThrough();
  };
