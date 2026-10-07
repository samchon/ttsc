import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies resolveTsgo accepts `TTSC_TSGO_BINARY` as an explicit compiler
 * override.
 *
 * Pins the env-var escape hatch that lets developers point ttsc at a custom
 * tsgo binary (e.g. a locally compiled debug build) without touching the
 * installed `typescript` package. When `TTSC_TSGO_BINARY` is set, the resolver
 * must return it with `version: "custom"` to indicate the binary identity was
 * not read from a package.json.
 *
 * 1. Write an empty file at a temp path to act as a fake tsgo binary.
 * 2. Call `resolveTsgo` with `env.TTSC_TSGO_BINARY` pointing at that file.
 * 3. Assert the result `binary` equals the path and `version` is `"custom"`.
 * 4. Assert a relative override and a missing absolute override each throw an
 *    "existing absolute path" error.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveTsgo with only an env TTSC_TSGO_BINARY and asserts the returned binary path and the "custom" version for an existing absolute file, then asserts the throw for a relative path and for a missing absolute path.
 * @evidence contracts/testing.md#independent-expectations The expected binary is the authored temp path and the expected version is the literal "custom" the resolver contract defines for explicit overrides; no package.json is read or needed, and the error is matched by the literal phrase "existing absolute path".
 * @evidence contracts/testing.md#distinguishing-cases The existing absolute file is accepted, while "relative-tsgo" (relative, nonexistent) and a nonexistent absolute path inside the temp directory are refused. A relative path that exists is not covered, so the two refusal conditions are not separated from each other.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/tsgo; it calls resolveTsgo directly over an empty file in a TestProject.tmpdir directory, which is never executed. No typescript package is installed and no compiler is launched.
 */
export function test_resolvetsgo_accepts_ttsc_tsgo_binary_as_an_explicit_compiler() {
  const root = TestProject.tmpdir("ttsc-tsgo-test-");
  const binary = path.join(root, "tsgo");
  fs.writeFileSync(binary, "", "utf8");

  const resolved = resolveTsgo({
    env: { TTSC_TSGO_BINARY: binary },
  });

  assert.equal(resolved.binary, binary);
  assert.equal(resolved.version, "custom");
  for (const override of ["relative-tsgo", path.join(root, "missing-tsgo")]) {
    assert.throws(
      () => resolveTsgo({ env: { TTSC_TSGO_BINARY: override } }),
      /existing absolute path/,
    );
  }
}
