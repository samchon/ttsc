import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that a native POSIX filename cannot alias a different snapshot file.
 *
 * 1. Admit the literal replacement character and an excluded raw backup.
 * 2. Add an included raw name that decodes to the same string as the file.
 * 3. Check the digest and materializer diagnose the raw name, then remove it and
 *    verify the original snapshot remains intact.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual digest and native workspace materializer on a real directory and observes both accepted bytes and rejection.
 * @evidence contracts/testing.md#independent-expectations A literal UTF-8 name, handwritten invalid byte and fixed text establish the collision and expected copied bytes.
 * @evidence contracts/testing.md#distinguishing-cases The valid filename and the excluded backup work, while a raw included filename in the same nested directory is refused by both operations. Windows and volumes returning EILSEQ skip the byte-name fixture.
 * @evidence contracts/testing.md#execution-ownership All files and scratch outputs live in one owned temporary tree. Cleanup unlinks the raw names by Buffer before recursively removing the tree.
 */
export function test_source_snapshot_rejects_lossy_descendant_names(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-source-raw-entry-"),
  );
  const source = path.join(root, "source");
  const assets = path.join(source, "assets");
  const twin = "data-\ufffd.txt";
  const raw = Buffer.concat([
    Buffer.from(`${assets}/data-`),
    Buffer.from([0xff]),
    Buffer.from(".txt"),
  ]);
  const excluded = Buffer.concat([raw, Buffer.from("~")]);
  let excludedCreated = false;
  let rawCreated = false;
  try {
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, twin), "literal UTF-8");
    if (process.platform !== "win32") {
      try {
        fs.writeFileSync(excluded, "excluded backup");
        excludedCreated = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EILSEQ") throw error;
      }
    }

    const digest = pluginSourceDigest(source);
    const first = path.join(root, "first");
    SourcePluginWorkspace.materialize(source, first);
    assert.deepEqual(fs.readdirSync(path.join(first, "assets")), [twin]);
    assert.equal(
      fs.readFileSync(path.join(first, "assets", twin), "utf8"),
      "literal UTF-8",
    );
    assert.equal(pluginSourceDigest(first), digest);
    if (!excludedCreated) return;

    fs.writeFileSync(raw, "different raw bytes");
    rawCreated = true;
    const diagnostic = /not valid UTF-8 \(hex 646174612dff2e747874\)/;
    assert.throws(() => pluginSourceDigest(source), diagnostic);
    assert.throws(
      () =>
        SourcePluginWorkspace.materialize(source, path.join(root, "rejected")),
      diagnostic,
    );

    fs.unlinkSync(raw);
    rawCreated = false;
    assert.equal(pluginSourceDigest(source), digest);
  } finally {
    if (rawCreated) fs.unlinkSync(raw);
    if (excludedCreated) fs.unlinkSync(excluded);
    fs.rmSync(root, { recursive: true });
  }
}
