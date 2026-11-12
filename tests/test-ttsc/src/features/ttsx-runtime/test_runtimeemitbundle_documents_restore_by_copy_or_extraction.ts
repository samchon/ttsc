import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";

/**
 * Verifies a persistent emit document keeps raw bytes in the run bundle's own
 * layout, so it is restored by one copy or by verified extraction.
 *
 * The earlier document carried every output as base64 inside JSON inside JSON,
 * which each warm start parsed twice and decoded three times before writing the
 * same bytes back out (samchon/ttsc#1852).
 *
 * 1. Archive outputs with an owner annex and inspect the document.
 * 2. Restore it by copy and read through the run bundle; extract it as files.
 * 3. Refuse what cannot be trusted: a bare artifact, a damaged body, an occupied
 *    destination, and a map reference needing file lookup.
 *
 * @evidence contracts/testing.md#behavioral-verification The production archive, inspection, copy restore and extraction run over real files; restored bytes are read back through the run bundle and from disk, and a released descriptor lets the run directory be removed.
 * @evidence contracts/testing.md#independent-expectations Authored output texts, a non-UTF-8 byte sequence and the authored annex are the expected bytes; document size is compared with their summed lengths, which a text encoding would exceed.
 * @evidence contracts/testing.md#distinguishing-cases A bundleable document, one whose JavaScript names a map that is not its recorded sibling, a bare run artifact without an annex, a flipped body byte and an existing destination file separate both restore forms and each refusal.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls the maintained owner over an owned temporary tree without a compiler or product host; finally removes the tree.
 */
export function test_runtimeemitbundle_documents_restore_by_copy_or_extraction(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-emit-document-"));
  try {
    const script = "exports.value = 7;\n//# sourceMappingURL=main.js.map";
    const map = '{"version":3,"sources":[],"names":[],"mappings":""}';
    const binary = Buffer.from([0xff, 0x00, 0xfe, 0x80, 0x0a]);
    const outputs: [string, Buffer][] = [
      [path.join("lib", "main.js"), Buffer.from(script)],
      [path.join("lib", "main.js.map"), Buffer.from(map)],
      ["data.bin", binary],
    ];
    const annex = JSON.stringify({ owner: "authored annex" });
    const document = path.join(root, "document.emit");
    RuntimeEmitBundle.archive(document, outputs, annex);
    assert.throws(
      () => RuntimeEmitBundle.archive(document, outputs, annex),
      "an existing document is never replaced",
    );

    const inspected = RuntimeEmitBundle.inspect(document);
    assert.equal(inspected.annex, annex);
    assert.equal(inspected.bundleable, true);
    assert.deepEqual(
      inspected.names,
      outputs.map(([name]) => name),
    );
    const raw = outputs.reduce((sum, [, bytes]) => sum + bytes.length, 0);
    const size = fs.statSync(document).size;
    assert.ok(
      size > raw && size < raw + 1024,
      `raw bodies of ${raw} bytes stored in ${size}`,
    );

    // Copy: the run owns its bytes after the document is collected.
    const bundled = path.join(root, "bundled");
    fs.mkdirSync(bundled);
    assert.equal(
      RuntimeEmitBundle.restore(document, bundled, inspected.names),
      true,
    );
    const run = RuntimeEmitBundle.open(bundled)!;
    assert.equal(run.read(path.join(bundled, "lib", "main.js")), script);
    assert.equal(run.read(path.join(bundled, "lib", "main.js.map")), map);
    assert.equal(run.read(path.join(bundled, "lib", "absent.js")), null);
    assert.equal(fs.existsSync(path.join(bundled, "lib", "main.js")), false);
    assert.throws(
      () => RuntimeEmitBundle.restore(document, bundled, inspected.names),
      "an existing run artifact is never replaced",
    );
    // A descriptor serves the reads; releasing it frees the directory.
    RuntimeEmitBundle.release();
    fs.rmSync(bundled, { recursive: true });
    assert.equal(fs.existsSync(bundled), false);

    // Extraction: ordinary files, each verified against the index.
    const extracted = path.join(root, "extracted");
    fs.mkdirSync(extracted);
    const written: string[] = [];
    RuntimeEmitBundle.extract(document, extracted, written);
    assert.deepEqual(
      written,
      outputs.map(([name]) => path.join(extracted, name)),
    );
    for (const [name, bytes] of outputs)
      assert.deepEqual(fs.readFileSync(path.join(extracted, name)), bytes);
    const occupied: string[] = [];
    assert.throws(
      () => RuntimeEmitBundle.extract(document, extracted, occupied),
      "an existing output is never replaced",
    );
    assert.deepEqual(occupied, []);

    // A run artifact carries no annex, so it is not a document.
    assert.throws(() =>
      RuntimeEmitBundle.inspect(path.join(extracted, "..", "missing.emit")),
    );
    const bare = path.join(root, "bare");
    fs.mkdirSync(bare);
    assert.equal(
      RuntimeEmitBundle.write(bare, [
        ["main.js", Buffer.from("exports.value = 7;").toString("base64")],
      ]),
      true,
    );
    assert.throws(() =>
      RuntimeEmitBundle.inspect(path.join(bare, RuntimeEmitBundle.filename)),
    );

    // A damaged body is never restored as an output.
    const damaged = path.join(root, "damaged.emit");
    const bytes = fs.readFileSync(document);
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    fs.writeFileSync(damaged, bytes);
    const partial = path.join(root, "partial");
    fs.mkdirSync(partial);
    assert.throws(() => RuntimeEmitBundle.extract(damaged, partial, []));
    assert.equal(fs.existsSync(path.join(partial, "data.bin")), false);
    const copied = path.join(root, "copied");
    fs.mkdirSync(copied);
    assert.equal(
      RuntimeEmitBundle.restore(damaged, copied, inspected.names),
      true,
    );
    assert.throws(
      () => RuntimeEmitBundle.open(copied),
      "opening a copied artifact verifies every body",
    );

    // A map reference that is not the recorded sibling needs file lookup.
    const external = path.join(root, "external.emit");
    RuntimeEmitBundle.archive(
      external,
      [
        [
          "main.js",
          Buffer.from("exports.value = 7;\n//# sourceMappingURL=other.map"),
        ],
      ],
      annex,
    );
    assert.equal(RuntimeEmitBundle.inspect(external).bundleable, false);
  } finally {
    RuntimeEmitBundle.release();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
