import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeInputContents } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeInputContents";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";

/**
 * Verifies a content session that witnessed only part of its population keeps
 * the rows it did not witness.
 *
 * A replay stops at the first input that moved, so its session witnesses a few
 * files of thousands. Publishing only those rows dropped every other one, and
 * the next capture read every file of the project again (samchon/ttsc#1859). A
 * session that witnessed the whole population still replaces the record, so
 * rows of files no longer selected leave it.
 *
 * 1. Record three files with a complete session.
 * 2. Witness one of them, changed, in a partial session.
 * 3. Record a smaller population with a complete session.
 *
 * @evidence contracts/testing.md#behavioral-verification The production session writes its record into a real content store; the record file's rows are read back directly.
 * @evidence contracts/testing.md#independent-expectations The authored files decide which rows must exist after each session: three, still three after the partial one with the changed file's new hash, then two.
 * @evidence contracts/testing.md#distinguishing-cases A complete session, a partial session that changed one row and a complete session over fewer files separate merging from replacing.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export; the test owns its temporary project and cache and removes them in finally.
 */
export function test_runtimeinputcontents_keeps_rows_a_partial_session_did_not_witness(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-partial-rows-")),
  );
  try {
    const files = ["a.ts", "b.ts", "c.ts"].map((name) => path.join(root, name));
    for (const file of files) fs.writeFileSync(file, `// ${file}\n`);
    const subject = path.join(root, "tsconfig.json");
    const open = () => {
      const store = PluginContentIdentities.open({
        projectRoot: root,
        cacheDir: path.join(root, "cache"),
        env: {},
      });
      assert.ok(store);
      return store;
    };
    const rows = (store: PluginContentIdentities.Store) =>
      Object.keys(
        JSON.parse(
          fs.readFileSync(
            PluginContentIdentities.recordLocation(
              store,
              "runtime-input-content-v3:raw",
              subject,
            ),
            "utf8",
          ),
        ).rows,
      ).sort();

    let store = open();
    let session = RuntimeInputContents.open(subject, store);
    session.observe(files);
    session.close(true);
    assert.deepEqual(rows(store), [...files].sort());

    fs.writeFileSync(files[0]!, "// changed\n");
    store = open();
    session = RuntimeInputContents.open(subject, store);
    session.observe([files[0]!]);
    session.close();
    assert.deepEqual(
      rows(store),
      [...files].sort(),
      "a partial session keeps the rows it did not witness",
    );

    store = open();
    session = RuntimeInputContents.open(subject, store);
    session.observe(files.slice(0, 2));
    session.close(true);
    assert.deepEqual(
      rows(store),
      files.slice(0, 2).sort(),
      "a complete session drops rows of files it no longer selects",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
