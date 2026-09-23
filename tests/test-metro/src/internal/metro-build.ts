import assert from "node:assert/strict";
import fs from "node:fs";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * Asserts that `@ttsc/unplugin` stays external in the built Metro output and
 * that no virtual-module shim is inlined.
 *
 * Bundling `@ttsc/unplugin` into the Metro output would inflate the artifact
 * and shadow the version the consuming project installed, and a virtual-module
 * shim is the trace a bundling externals plugin leaves behind.
 */
export function assertMetroBuildKeepsRuntimeDependenciesExternal(): void {
  const cjs = readLib("transformer", "js");
  const esm = readLib("transformer", "mjs");

  assert.match(cjs, /require\('@ttsc\/unplugin\/api'\)/);
  assert.match(esm, /from '@ttsc\/unplugin\/api'/);

  for (const output of [cjs, esm]) {
    assert.doesNotMatch(output, /_virtual/);
  }
}

function readLib(entry: string, extension: "js" | "mjs"): string {
  const file = TestMetroRuntime.libPath(entry, extension);
  assert.equal(fs.existsSync(file), true, file);
  return fs.readFileSync(file, "utf8");
}
