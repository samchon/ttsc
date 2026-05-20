import { assert, resolveBinary } from "../../internal/platform";

/**
 * Verifies resolveBinary prefers the `TTSC_BINARY` absolute override.
 *
 * Pins the env-var escape hatch that lets operators point the launcher at a
 * custom binary (e.g. a locally built debug binary) without changing the
 * installed package. When `TTSC_BINARY` is set to an absolute path, the
 * resolver must return it verbatim without any platform-package lookup.
 *
 * 1. Call `resolveBinary` with `env.TTSC_BINARY` set to an absolute path.
 * 2. Assert the returned path equals the override value exactly.
 */
export const test_resolvebinary_prefers_ttsc_binary_absolute_override = () => {
  const resolved = resolveBinary({
    env: {
      TTSC_BINARY: "/tmp/custom-ttsc",
    },
  });
  assert.equal(resolved, "/tmp/custom-ttsc");
};
