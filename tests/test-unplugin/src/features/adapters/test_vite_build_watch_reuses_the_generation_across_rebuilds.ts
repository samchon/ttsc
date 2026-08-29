import { assertViteBuildWatchReusesTheGenerationAcrossRebuilds } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies `vite build --watch` reuses one generation across rebuilds.
 *
 * The samchon/ttsc#1301 defect: `buildEnd` means "the session ended" only under
 * `serve`, where Vite's plugin container calls it on close. Under `build`,
 * Rollup calls it at the end of every build phase and its watcher repeats build
 * phases, so disposing there discarded the generation once per rebuild
 * independently of the `buildStart` clear — which is why fixing one of the two
 * sites alone left this host recompiling the whole project per edit.
 *
 * 1. Resolve the adapter with `command: "build"`.
 * 2. Drive three full `buildStart` → deliver → `buildEnd` rebuild passes.
 * 3. Assert the fixture plugin ran exactly one whole-project compile.
 */
export const test_vite_build_watch_reuses_the_generation_across_rebuilds =
  async () => {
    await assertViteBuildWatchReusesTheGenerationAcrossRebuilds();
  };
