import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies `allowJs` decides whether emitted JavaScript is a membership change.
 *
 * The rule the fix replaced a name list with. A project that admits no
 * JavaScript cannot gain a program input when a `.js` file appears, so the
 * appearance is not membership. A project that admits JavaScript can, so it is,
 * and refusing to invalidate there would be the correctness half of the same
 * defect in the other direction.
 */
export async function test_transformttsc_allowjs_decides_javascript_membership(): Promise<void> {
  const strict = await startMembershipSession();
  try {
    await strict.pass();
    assert.equal(strict.compiles(), 1);
    fs.writeFileSync(
      path.join(strict.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await strict.pass();
    assert.equal(
      strict.compiles(),
      1,
      "a project that admits no JavaScript must not treat a .js file as membership",
    );
  } finally {
    strict.close();
  }

  const widened = await startMembershipSession({ allowJs: true });
  try {
    await widened.pass();
    assert.equal(widened.compiles(), 1);
    fs.writeFileSync(
      path.join(widened.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await widened.pass();
    assert.equal(
      widened.compiles(),
      2,
      "a project that admits JavaScript must treat a new .js file as membership",
    );
  } finally {
    widened.close();
  }
}
