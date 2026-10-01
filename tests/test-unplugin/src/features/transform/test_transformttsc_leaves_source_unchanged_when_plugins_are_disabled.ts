import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";

/**
 * Verifies explicit plugin disabling returns before descriptor evaluation.
 *
 * The consumer declares a descriptor that records evaluation and throws. A
 * disabled transform must leave that descriptor and the source untouched.
 *
 * 1. Write a consumer whose plugin descriptor records its evaluation and then
 *    throws.
 * 2. Transform a source with plugins explicitly disabled.
 * 3. Require no result, an unevaluated descriptor and an unchanged source file.
 *
 * @evidence contracts/testing.md#behavioral-verification A real consumer with a fail-fast descriptor returns undefined under plugins:false, leaves its evaluation marker absent, and preserves source bytes.
 * @evidence contracts/testing.md#independent-expectations The descriptor writes a literal marker before throwing; marker absence and the original source string establish expectations without consulting transform output or selection helpers.
 * @evidence contracts/testing.md#distinguishing-cases Explicit false overrides a tsconfig plugin declaration before descriptor evaluation; this early return does not claim a native compile or adapter build connection.
 * @evidence contracts/testing.md#execution-ownership The source-unit runner discovers this named entry under unit/transform and imports authored resolveOptions and transformTtsc. It needs only an isolated consumer directory, removed in finally; no native producer, Go probe, or built API preparation executes.
 */
export async function test_transformttsc_leaves_source_unchanged_when_plugins_are_disabled(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-disabled-plugins-"));
  try {
    const file = path.join(root, "main.ts");
    const marker = path.join(root, "descriptor-evaluated");
    const source = 'export const value: string = "plugin";\n';
    fs.writeFileSync(file, source);
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "./plugin.cjs" }] },
        files: ["main.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "evaluated"); throw new Error("disabled descriptor must not run");`,
    );
    const result = await transformTtsc(
      file,
      source,
      resolveOptions({ plugins: false }),
    );
    assert.equal(result, undefined);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(file, "utf8"), source);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
