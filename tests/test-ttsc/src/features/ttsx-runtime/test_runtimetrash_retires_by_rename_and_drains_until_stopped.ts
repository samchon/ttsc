import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeTrash } from "../../../../../packages/ttsc/src/internal/RuntimeTrash";

/**
 * Verifies a run directory is retired by one rename and its files are deleted
 * later, by a drain that stops on request.
 *
 * Removing a compiled run's thousands of files before the launcher exited held
 * the terminal for up to twenty-six seconds (samchon/ttsc#1859). Retiring
 * renames the directory into the trash beside it; a later launcher deletes the
 * trash while its own program runs.
 *
 * 1. Retire a populated run directory and a missing one.
 * 2. Drain the trash to completion.
 * 3. Stop a drain at once, then let another one finish what it left.
 *
 * @evidence contracts/testing.md#behavioral-verification The production namespace renames and deletes a real tree; the run index's entries and the trash's presence are observed directly.
 * @evidence contracts/testing.md#independent-expectations The authored tree's directories and files determine what must leave the run index and what the drain must delete.
 * @evidence contracts/testing.md#distinguishing-cases A populated directory, a missing directory, a drain run to completion and a drain stopped at once followed by a second drain separate retirement, refusal and deletion.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export; the test owns its temporary tree and removes it in finally.
 */
export async function test_runtimetrash_retires_by_rename_and_drains_until_stopped(): Promise<void> {
  const runs = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-trash-"));
  const populate = (name: string): string => {
    const run = path.join(runs, name);
    for (let directory = 0; directory < 8; ++directory)
      for (let file = 0; file < 40; ++file) {
        const location = path.join(run, "fs", `d${directory}`, `f${file}.js`);
        fs.mkdirSync(path.dirname(location), { recursive: true });
        fs.writeFileSync(location, "output");
      }
    return run;
  };
  const trash = path.join(runs, RuntimeTrash.DIRNAME);
  const drained = async (): Promise<void> => {
    for (let attempt = 0; attempt < 600 && fs.existsSync(trash); ++attempt)
      await new Promise((resolve) => setTimeout(resolve, 50));
  };
  try {
    const run = populate("run-1");
    assert.equal(RuntimeTrash.retire(run, runs), true);
    assert.deepEqual(fs.readdirSync(runs), [RuntimeTrash.DIRNAME]);
    assert.equal(fs.readdirSync(trash).length, 1);
    assert.equal(
      RuntimeTrash.retire(path.join(runs, "absent"), runs),
      false,
      "a directory that cannot be renamed stays the caller's",
    );

    RuntimeTrash.drain(runs);
    await drained();
    assert.equal(fs.existsSync(trash), false, "the drain deletes everything");

    assert.equal(RuntimeTrash.retire(populate("run-2"), runs), true);
    const stop = RuntimeTrash.drain(runs);
    stop();
    // Removals already started settle; nothing else is deleted afterwards.
    await new Promise((resolve) => setTimeout(resolve, 100));
    RuntimeTrash.drain(runs);
    await drained();
    assert.equal(
      fs.existsSync(trash),
      false,
      "a later drain finishes the work",
    );
  } finally {
    fs.rmSync(runs, { recursive: true, force: true });
  }
}
