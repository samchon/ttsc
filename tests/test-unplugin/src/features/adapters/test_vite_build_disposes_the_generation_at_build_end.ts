import { assertViteBuildDisposesTheGenerationAtBuildEnd } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies an ordinary `vite build` still disposes its generation at buildEnd.
 *
 * The disposal boundary turns on whether the host is watching, not on which
 * command it runs. Vite takes Rollup's watcher only when `build.watch` is set;
 * an ordinary build closes its bundle instead and never emits `closeWatcher`,
 * so gating the buildEnd reset on `command === "serve"` alone would leave a
 * one-shot build with no disposal site at all. This is the negative twin of the
 * watching case, and the two differ only in `build.watch`.
 *
 * 1. Resolve the adapter with `command: "build"` and `build.watch: null`.
 * 2. Drive one full buildStart, deliver, buildEnd pass.
 * 3. Start another pass without any closeWatcher and assert it compiles again.
 */
export const test_vite_build_disposes_the_generation_at_build_end =
  async () => {
    await assertViteBuildDisposesTheGenerationAtBuildEnd();
  };
