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
 *
 * @evidence contracts/testing.md#behavioral-verification The authored upstream resolver reports an absent custom module as ordinary absence with no initialization cause.
 * @evidence contracts/testing.md#independent-expectations The literal nonexistent specifier and documented configured-upstream absence diagnostic determine the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Actual require.resolve absence contrasts module initialization and transitive-dependency failures.
 * @evidence contracts/testing.md#execution-ownership This matching src/unit export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_upstream_genuinely_absent_candidate_stays_non_fatal =
  async () => {
    await assertAbsentConfiguredPathReportsNotLoaded();
  };
