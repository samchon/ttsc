import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pluginSourceDigest } from "ttsc/plugin-source";

import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/lib/core/transform/clock/refreshFilesystemClockReference.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { pluginSourceFilesDigest } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceFilesDigest.mjs";

/**
 * Verifies a plugin source's files are read again only when their metadata
 * moved since the digest last read under it, or cannot vouch for their bytes.
 *
 * A plugin source its tracker cannot vouch for is re-proven on every delivery:
 * on macOS, one outside the project root, whose stream no probe proves
 * delivered (samchon/ttsc#1453). Reading its files each time cost 169 ms for
 * typia's 622-file module root, on every delivery. The digest is now kept while
 * the metadata of exactly the files it reads holds still, and only once every
 * stamp provably left its clock tick before the read, so no later write can
 * keep the metadata; the rule the universal entries' signatures follow.
 *
 * 1. Write a source whose stamps lie in the past, mint the clock reference, and
 *    assert the first digest reads every file and equals ttsc's, and the next
 *    reads none.
 * 2. Edit a file, and assert the next digest reads the files and follows the edit,
 *    and the one after reads them again: the new stamp is not yet separable
 *    from the clock reference.
 * 3. Mint a newer clock reference, and assert the digest is read once and then
 *    kept again.
 * 4. Add a file, and remove one, and assert each is read again.
 * 5. Keep the digest, then leave the filesystem with no clock reference, as a
 *    failed refresh does, and assert the unchanged signature is not reused: a
 *    reference minted now is what rules out a write that a clock rollback put
 *    into a recorded stamp's tick.
 */
export async function test_plugin_source_files_are_read_again_only_when_their_metadata_moves(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-plugin-source-reads-"),
  );
  const source = path.join(root, "plugin");
  const reference = path.join(root, "clock");
  fs.mkdirSync(reference);
  TestProject.writeFiles(source, {
    "go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "internal/rules/rule.go": "package rules\n",
    "main.go": "package main\n\nfunc main() {}\n",
  });
  const files = () =>
    fs
      .readdirSync(source, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));
  /** Move every stamp an hour back, out of any tick a reference minted now. */
  const settle = () => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of files()) fs.utimesSync(file, past, past);
  };
  const reads: string[] = [];
  const original = fs.readFileSync;
  fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (typeof file === "string" && file.startsWith(source)) reads.push(file);
    return (original as (...args: unknown[]) => unknown)(file, ...rest);
  }) as typeof fs.readFileSync;
  /** Take the digest, and how many files it read. */
  const digest = () => {
    reads.length = 0;
    const value = pluginSourceFilesDigest(
      source,
      DEFAULT_FILESYSTEM_OPERATIONS,
    );
    return { read: reads.length, value };
  };
  try {
    // 1. Read once, then kept.
    settle();
    refreshFilesystemClockReference(reference, DEFAULT_FILESYSTEM_OPERATIONS);
    const first = digest();
    assert.equal(first.read, 3, "every file is read once");
    assert.equal(first.value, pluginSourceDigest(source));
    assert.deepEqual(digest(), { read: 0, value: first.value }, "then kept");

    // 2. An edit is read, and its stamp is not yet separable.
    fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
    const edited = digest();
    assert.equal(edited.read, 3, "an edit moves the metadata");
    assert.notEqual(edited.value, first.value);
    assert.equal(edited.value, pluginSourceDigest(source));
    assert.equal(digest().read, 3, "a stamp inside the reference's tick");

    // 3. A newer reference lets the digest be kept again.
    settle();
    refreshFilesystemClockReference(reference, DEFAULT_FILESYSTEM_OPERATIONS);
    assert.equal(digest().read, 3);
    assert.equal(digest().read, 0, "kept again");

    // 4. A file added, and one removed.
    fs.writeFileSync(path.join(source, "extra.go"), "package main\n");
    settle();
    const added = digest();
    assert.equal(added.read, 4, "a new file moves the metadata");
    assert.equal(added.value, pluginSourceDigest(source));
    assert.equal(digest().read, 0);
    fs.rmSync(path.join(source, "internal", "rules", "rule.go"));
    const removed = digest();
    assert.equal(removed.read, 3, "a removed file moves it too");
    assert.equal(removed.value, pluginSourceDigest(source));

    // 5. Kept, then no reference: the unchanged signature is not reused.
    refreshFilesystemClockReference(reference, DEFAULT_FILESYSTEM_OPERATIONS);
    digest();
    assert.equal(digest().read, 0, "kept under a reference");
    refreshFilesystemClockReference(undefined, DEFAULT_FILESYSTEM_OPERATIONS);
    assert.equal(
      digest().read,
      3,
      "a signature no reference separates is not reused, as after a clock rollback",
    );
  } finally {
    fs.readFileSync = original;
  }
}
