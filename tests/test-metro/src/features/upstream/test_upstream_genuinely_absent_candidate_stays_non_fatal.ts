import { assertAbsentConfiguredPathReportsNotLoaded } from "../../internal/metro-upstream";

/**
 * Verifies an explicit upstream path that does not resolve is reported as
 * absence, not as a broken installation.
 *
 * Pins the absence branch of `tryRequire` on the real loader: `require.resolve`
 * fails with `MODULE_NOT_FOUND` for a specifier that is not installed, so the
 * candidate is genuinely absent and yields the "could not load the configured
 * upstream transformer" guidance rather than a wrapped initialization failure
 * with a `cause`. The negative twin of the init-failure cases.
 *
 * 1. Point `upstreamTransformer` at a module specifier that does not resolve.
 * 2. Resolve it through the real loader.
 * 3. Assert the absence message, with no init-failure wrapper and no `cause`.
 */
export const test_upstream_genuinely_absent_candidate_stays_non_fatal =
  async () => {
    await assertAbsentConfiguredPathReportsNotLoaded();
  };
