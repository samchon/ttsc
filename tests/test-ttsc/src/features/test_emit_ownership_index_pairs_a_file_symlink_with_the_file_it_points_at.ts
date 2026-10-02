import { TestProject } from "../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";

/**
 * Verifies the emit ownership index pairs a file symlink with the file it
 * points at, whatever the link is named.
 *
 * A file symlink may carry any name, so a lookup by spelling cannot pair it
 * with the output the producer wrote for its target. Only physical identity
 * does, and the source the producer recorded is the link's target
 * (samchon/ttsc#1382). Creating a file symlink needs a privilege Windows may
 * withhold, so this case is its own entry: when the host refuses the link the
 * entry returns false and the runner reports it as skipped, claiming no
 * coverage.
 *
 * 1. Write a source under a root and a differently named file symlink to it.
 * 2. Record the output the producer wrote for the target's physical path.
 * 3. Assert looking up the target, and the differently named link, each return
 *    that output.
 *
 * @evidence contracts/testing.md#behavioral-verification EmitOwnershipIndex.find on the link's target and on the link's own path returns the recorded shortcut.js output after the index is built from the target's physical path, so identity rather than the link's spelling owns the pairing.
 * @evidence contracts/testing.md#independent-expectations The authored producer record names the target's native realpath and the expected output path is the authored emit location; the index does not generate either.
 * @evidence contracts/testing.md#distinguishing-cases One positive case: a source reached through a differently named file symlink. The index is built while the link exists; same-name siblings, junction aliases and recorded-output refusals are owned by test_emit_ownership_index_answers_only_with_the_output_of_the_same_file.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features; it calls EmitOwnershipIndex over files in a TestProject.tmpdir directory, builds and installs nothing, starts no compiler, and returns false when the host denies file-symlink creation.
 */
export function test_emit_ownership_index_pairs_a_file_symlink_with_the_file_it_points_at(): void | false {
  const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-ownership-link-"));
  const root = path.join(base, "root");
  const emit = path.join(base, "emit");
  const write = (file: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "//" + String.fromCharCode(10));
  };
  const target = path.join(root, "target", "renamed.ts");
  write(target);
  try {
    fs.symlinkSync(target, path.join(root, "shortcut.ts"), "file");
  } catch (error) {
    console.warn(
      `SKIPPED file-symlink emit ownership: ${(error as NodeJS.ErrnoException).code ?? String(error)}`,
    );
    return false;
  }
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
    index.find(path.join(root, "shortcut.ts")),
    path.join(emit, "shortcut.js"),
    "the link resolves by identity to the output recorded for its target",
  );
}
