import assert from "node:assert/strict";

import { pickEmittedJS } from "../../../../packages/playground/src/compiler/pickEmittedJS";

/**
 * Verifies the entry's own output wins over a sibling JavaScript key that
 * appears earlier in the output map.
 *
 * Object key order is insertion order, so a first-`.js` fallback alone would
 * return the sibling. The entry candidates must be consulted first.
 *
 * 1. Place `dist/helper.js` before `dist/playground.js` and pick for `playground.ts`.
 * 2. Remove the entry output and observe the sibling become the fallback.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls pickEmittedJS with sibling-first maps and compares the returned text with authored literals.
 * @evidence contracts/testing.md#independent-expectations The texts ENTRY and SIBLING name which key was chosen, independent of the picker.
 * @evidence contracts/testing.md#distinguishing-cases The same map with and without the entry key contrasts candidate preference with fallback.
 * @evidence contracts/testing.md#execution-ownership Unit entry calling only the pure pickEmittedJS function; the full candidate order is owned by test_pick_emitted_js_prefers_the_entry_output_before_any_other_js.
 */
export function test_pick_emitted_js_prefers_dist_entry_over_an_earlier_sibling(): void {
  assert.equal(
    pickEmittedJS(
      { "dist/helper.js": "SIBLING", "dist/playground.js": "ENTRY" },
      "playground.ts",
    ),
    "ENTRY",
  );
  assert.equal(
    pickEmittedJS({ "dist/helper.js": "SIBLING" }, "playground.ts"),
    "SIBLING",
  );
}
