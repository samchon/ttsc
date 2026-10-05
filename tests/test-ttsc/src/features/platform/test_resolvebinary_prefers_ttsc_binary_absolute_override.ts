import assert from "node:assert/strict";
import path from "node:path";

import { resolveBinary } from "../../../../../packages/ttsc/src/compiler/internal/resolveBinary";

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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveBinary returns an absolute override verbatim and never chooses a relative override.
 * @evidence contracts/testing.md#independent-expectations the explicit absolute override precedes platform lookup without requiring the target to exist.
 * @evidence contracts/testing.md#distinguishing-cases the absolute spelling contrasts with the relative spelling that must be ignored, which may resolve only to null or an absolute fallback path.
 * @evidence contracts/testing.md#execution-ownership The named test_resolvebinary_prefers_ttsc_binary_absolute_override function runs under src/features/platform and calls the authored resolver with explicit environment inputs directly; the relative-input control uses the existing workspace package fallback without installing or launching it.
 */
export function test_resolvebinary_prefers_ttsc_binary_absolute_override() {
  const resolved = resolveBinary({
    env: {
      TTSC_BINARY: "/tmp/custom-ttsc",
    },
  });
  assert.equal(resolved, "/tmp/custom-ttsc");
  const ignored = resolveBinary({ env: { TTSC_BINARY: "relative-ttsc" } });
  assert.notEqual(ignored, "relative-ttsc");
  assert.ok(
    ignored === null || path.isAbsolute(ignored),
    "a relative override is ignored, leaving only the absolute fallbacks or null",
  );
}
