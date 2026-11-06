import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";

/**
 * Verifies ordinary compiler output never adopts a neighboring file as runtime
 * bundle authority, including a user file with the private artifact's name.
 *
 * 1. Author normal JavaScript, its source and an unrelated malformed marker.
 * 2. Inventory and resolve actual source ownership through the ordinary API.
 * 3. Read the owned JavaScript and reject bundle path traversal before writes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual inventory, provenance lookup and output reads must keep serving normal JS in the presence of an unrelated reserved-name file; an escaped bundle coordinate must not create an outside directory.
 * @evidence contracts/testing.md#independent-expectations Authored JS, its native physical source/output paths and a separately named outside path determine results without decoding product metadata.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary physical emit with malformed neighboring data contrasts explicitly bundled runtime generations; traversal refusal contrasts the valid bundle population covered by the cache-bundle unit.
 * @evidence contracts/testing.md#execution-ownership The named unit entry invokes maintained file/index owners over portable scratch, without compiler, installer or runtime host execution.
 */
export function test_runtimeemitbundle_preserves_unbundled_output_ownership(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-unbundled-owner-"));
  try {
    const source = path.join(root, "source.ts");
    const emitted = path.join(root, "main.js");
    fs.writeFileSync(source, "export const value = 7;");
    fs.writeFileSync(emitted, "exports.value = 7;");
    fs.writeFileSync(
      path.join(root, RuntimeEmitBundle.filename),
      "authored-neighbor",
    );
    const outputs = EmitOwnershipIndex.listOutputs(root);
    const index = new EmitOwnershipIndex({
      emitDir: root,
      rootDir: root,
      outputs,
      emittedSources: { [emitted]: [fs.realpathSync.native(source)] },
    });
    assert.equal(index.find(source), fs.realpathSync.native(emitted));
    assert.equal(index.readOutput(emitted), "exports.value = 7;");
    const outside = path.join(
      path.dirname(root),
      path.basename(root) + "-escape",
    );
    assert.throws(() =>
      RuntimeEmitBundle.write(root, [
        [path.join("..", path.basename(outside), "main.js"), "YWJj"],
      ]),
    );
    assert.equal(fs.existsSync(outside), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
