import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";

/**
 * Verifies resolveTsgo accepts TTSC_TSGO_BINARY as an explicit compiler.
 *
 * This ttsc tsgo resolver scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_resolvetsgo_accepts_ttsc_tsgo_binary_as_an_explicit_compiler =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-tsgo-test-"));
    const binary = path.join(root, "tsgo");
    fs.writeFileSync(binary, "", "utf8");

    const resolved = resolveTsgo({
      env: { TTSC_TSGO_BINARY: binary },
    });

    assert.equal(resolved.binary, binary);
    assert.equal(resolved.version, "custom");
  };
