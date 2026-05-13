import { assert, resolveBinary } from "../../internal/platform";

/**
 * Verifies resolveBinary prefers TTSC_BINARY absolute override.
 *
 * This ttsc platform scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_resolvebinary_prefers_ttsc_binary_absolute_override = () => {
  const resolved = resolveBinary({
    env: {
      TTSC_BINARY: "/tmp/custom-ttsc",
    },
  });
  assert.equal(resolved, "/tmp/custom-ttsc");
};
