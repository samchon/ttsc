import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";

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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveTsgo preserves the existing explicit file identity and custom version while refusing relative and missing overrides.
 * @evidence contracts/testing.md#independent-expectations explicit compiler authority requires an existing absolute path and uses custom metadata independently of package manifests.
 * @evidence contracts/testing.md#distinguishing-cases existing absolute file contrasts with relative and absent absolute paths.
 * @evidence contracts/testing.md#execution-ownership The named test_resolvetsgo_accepts_ttsc_tsgo_binary_as_an_explicit_compiler function runs under src/unit/tsgo and calls the authored resolver directly; manifests and empty binary files are filesystem inputs, not an installed or launched compiler.
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
      assert.throws(() => resolveTsgo({ env: { TTSC_TSGO_BINARY: override } }), /existing absolute path/);
    }
}
