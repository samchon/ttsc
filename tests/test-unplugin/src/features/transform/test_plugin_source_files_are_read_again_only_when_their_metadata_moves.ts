import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pluginSourceDigest } from "ttsc/plugin-source";

import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/lib/core/transform/clock/refreshFilesystemClockReference.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";
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
 * Whether the digest was kept or read is observed through the filesystem the
 * adapter is handed: an embedder's operations whose metadata holds still while
 * the bytes change. A kept digest then still describes the old bytes, and a
 * read one follows the new, as ttsc's own digest does.
 *
 * 1. Write a source whose stamps lie in the past, mint the clock reference, and
 *    assert the digest equals ttsc's. Hold the metadata, edit a file, and
 *    assert the digest is kept.
 * 2. Release the metadata, and assert the digest follows the edit. Hold it again
 *    and edit again, and assert the digest follows that edit too: the edited
 *    stamp is not yet separable from the clock reference, so nothing was kept.
 * 3. Mint a newer clock reference, and assert the digest is read once and then
 *    kept again.
 * 4. With every present file's metadata held, add a file, and remove one, and
 *    assert each is read again: the file set is part of the signature.
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
  const main = path.join(source, "main.go");
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

  const held = new Map<string, fs.BigIntStats>();
  const filesystem: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat: (location) =>
      held.get(path.resolve(location)) ??
      DEFAULT_FILESYSTEM_OPERATIONS.lstat(location),
  };
  /** Hold every present file's metadata where it stands now. */
  const hold = () => {
    held.clear();
    for (const file of files())
      held.set(path.resolve(file), DEFAULT_FILESYSTEM_OPERATIONS.lstat(file));
  };
  const release = () => held.clear();
  const mint = () => refreshFilesystemClockReference(reference, filesystem);
  const digest = () => pluginSourceFilesDigest(source, filesystem);
  const edit = (content: string) => fs.appendFileSync(main, content);

  // 1. Read, then kept while the metadata holds.
  settle();
  mint();
  const first = digest();
  assert.equal(first, pluginSourceDigest(source));
  hold();
  edit("// one\n");
  assert.equal(digest(), first, "kept while the metadata holds");
  assert.notEqual(pluginSourceDigest(source), first);

  // 2. An edit is read, and its stamp is not yet separable.
  release();
  assert.equal(digest(), pluginSourceDigest(source), "an edit is read");
  hold();
  edit("// two\n");
  assert.equal(
    digest(),
    pluginSourceDigest(source),
    "a stamp inside the reference's tick is not kept",
  );
  release();

  // 3. A newer reference lets the digest be kept again.
  settle();
  mint();
  const kept = digest();
  assert.equal(kept, pluginSourceDigest(source));
  hold();
  edit("// three\n");
  assert.equal(digest(), kept, "kept again");
  release();

  // 4. A file added, and one removed, under held metadata.
  settle();
  mint();
  digest();
  hold();
  fs.writeFileSync(path.join(source, "extra.go"), "package main\n");
  assert.equal(digest(), pluginSourceDigest(source), "a new file is read");
  release();
  settle();
  mint();
  digest();
  hold();
  fs.rmSync(path.join(source, "internal", "rules", "rule.go"));
  assert.equal(digest(), pluginSourceDigest(source), "a removal is read");
  release();

  // 5. Kept, then no reference: the unchanged signature is not reused.
  settle();
  mint();
  const before = digest();
  hold();
  edit("// four\n");
  assert.equal(digest(), before, "kept under a reference");
  refreshFilesystemClockReference(undefined, filesystem);
  assert.equal(
    digest(),
    pluginSourceDigest(source),
    "a signature no reference separates is not reused, as after a clock rollback",
  );
}
