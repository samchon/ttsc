import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";

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
 */
export const test_resolvetsgo_accepts_ttsc_tsgo_binary_as_an_explicit_compiler =
  () => {
    const root = TestProject.tmpdir("ttsc-tsgo-test-");
    const binary = path.join(root, "tsgo");
    fs.writeFileSync(binary, "", "utf8");

    const resolved = resolveTsgo({
      env: { TTSC_TSGO_BINARY: binary },
    });

    assert.equal(resolved.binary, binary);
    assert.equal(resolved.version, "custom");
  };
