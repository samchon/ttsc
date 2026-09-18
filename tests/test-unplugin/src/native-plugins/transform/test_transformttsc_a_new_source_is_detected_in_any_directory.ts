import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies a new source file is detected wherever it lands, including a
 * directory the old ignore list named.
 *
 * This is the correctness half of samchon/ttsc#1307. The ignore list matched a
 * bare entry name at every depth, so `src/build/` was dropped from the walk and
 * a program input created there was never seen: the adapter kept serving output
 * from a compile that had never read the file. The control and the subject are
 * the same file under two directory names, and before the fix they answered
 * differently.
 *
 * 1. Run passes until the generation settles.
 * 2. Add a source under `src/feature/` and assert the next pass recompiles.
 * 3. Add a source under `src/build/` and assert the next pass recompiles, then
 *    settles again.
 */
export async function test_transformttsc_a_new_source_is_detected_in_any_directory(): Promise<void> {
  const session = await startMembershipSession();
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const control = path.join(session.root, "src", "feature", "a.ts");
    fs.mkdirSync(path.dirname(control), { recursive: true });
    fs.writeFileSync(control, "export const a: number = 1;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a new source in an ordinary directory must replace the generation",
    );

    // The same file, under a name the old list refused to walk.
    const subject = path.join(session.root, "src", "build", "b.ts");
    fs.mkdirSync(path.dirname(subject), { recursive: true });
    fs.writeFileSync(subject, "export const b: number = 2;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a new source must be detected even where the old ignore list matched",
    );

    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "and the generation settles again once nothing moves",
    );
  } finally {
    session.close();
  }
}
