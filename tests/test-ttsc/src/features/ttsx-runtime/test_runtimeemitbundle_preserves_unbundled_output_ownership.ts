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
 * 3. Reject traversal and a real output-parent conflict, then retry successfully.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual inventory, provenance lookup and output reads keep serving normal JS beside unrelated reserved-name data. Traversal cannot create an outside directory. A real parent-kind conflict removes the incomplete owned artifact, preserves the blocker, and permits a successful subsequent write/read.
 * @evidence contracts/testing.md#independent-expectations Authored JS, its native physical source/output paths and a separately named outside path determine results without decoding product metadata.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary physical emit with malformed neighboring data contrasts explicitly bundled runtime generations; traversal refusal occurs before writes, while an output-parent conflict exercises cleanup after exclusive creation and a later retry. Native close failure is not fabricated; the writer's close-error branch is reviewed directly.
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
    const staging = path.join(root, "staging");
    fs.mkdirSync(staging);
    const blocker = path.join(staging, "nested");
    fs.writeFileSync(blocker, "preserved blocker");
    const name = path.join("nested", "main.js");
    const text = "exports.value = 7;";
    const encoded: [string, string][] = [
      [name, Buffer.from(text).toString("base64")],
    ];
    assert.throws(() => RuntimeEmitBundle.write(staging, encoded));
    assert.equal(fs.readFileSync(blocker, "utf8"), "preserved blocker");
    assert.equal(RuntimeEmitBundle.open(staging), undefined);
    fs.unlinkSync(blocker);
    assert.equal(RuntimeEmitBundle.write(staging, encoded), true);
    assert.equal(
      RuntimeEmitBundle.open(staging)!.read(path.join(staging, name)),
      text,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
