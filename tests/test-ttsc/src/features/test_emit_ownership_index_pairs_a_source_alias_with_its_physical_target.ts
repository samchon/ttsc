import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies source aliases receive the output owned by their physical target.
 *
 * Physical identity pairs an alias with the producer's captured source owner.
 * POSIX exercises a differently named file symlink; Windows exercises a source
 * reached through a differently named directory junction. Both must resolve to
 * the captured target before lookup. Windows does not exercise file-symlink
 * basename changes, which remain covered by the POSIX input.
 *
 * 1. Write a source and the platform's native source alias.
 * 2. Record the output the producer wrote for the target's physical path.
 * 3. Assert looking up the target, and the differently named link, each return
 *    that output.
 *
 * @evidence contracts/testing.md#behavioral-verification EmitOwnershipIndex.find on the target and its native alias returns the authored shortcut.js output; native realpath first proves both query coordinates name the captured source owner.
 * @evidence contracts/testing.md#independent-expectations The authored producer record names the target's native realpath and the expected output path is the authored emit location; the index does not generate either.
 * @evidence contracts/testing.md#distinguishing-cases The target and alias are positive controls; POSIX changes the file basename and Windows changes the directory spelling. Unrecorded sibling and absent-output distinctions are owned by test_emit_ownership_index_answers_only_with_the_output_of_the_same_file.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls the actual index over a private TestProject.tmpdir. Windows creates a directory junction without file-symlink privilege; POSIX creates the original file-symlink input. No installation, compiler or product host runs, and alias creation failure fails the case.
 */
export function test_emit_ownership_index_pairs_a_source_alias_with_its_physical_target(): void {
  const base = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-ownership-link-"),
  );
  const root = path.join(base, "root");
  const emit = path.join(base, "emit");
  const write = (file: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "//" + String.fromCharCode(10));
  };
  const target = path.join(root, "target", "renamed.ts");
  write(target);
  let alias: string;
  if (process.platform === "win32") {
    const directory = path.join(root, "shortcut");
    fs.symlinkSync(path.dirname(target), directory, "junction");
    alias = path.join(directory, path.basename(target));
  } else {
    alias = path.join(root, "shortcut.ts");
    fs.symlinkSync(target, alias, "file");
  }
  assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(target));
  write(path.join(emit, "shortcut.js"));
  const index = new EmitOwnershipIndex({
    emitDir: emit,
    rootDir: root,
    emittedSources: {
      [path.join(emit, "shortcut.js")]: [fs.realpathSync.native(target)],
    },
  });
  assert.equal(index.find(target), path.join(emit, "shortcut.js"));
  assert.equal(
    index.find(alias),
    path.join(emit, "shortcut.js"),
    "the link resolves by identity to the output recorded for its target",
  );
}
