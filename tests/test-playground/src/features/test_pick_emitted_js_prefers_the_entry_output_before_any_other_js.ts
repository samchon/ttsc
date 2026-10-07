import assert from "node:assert/strict";

import { pickEmittedJS } from "../../../../packages/playground/src/compiler/pickEmittedJS";

/**
 * Verifies the emitted-JavaScript picker prefers the entry file's own output in
 * its documented candidate order, then any JavaScript file, and never returns a
 * declaration or source map.
 *
 * The playground compiles one entry, but the output map is keyed by a path
 * layout that depends on the project's `outDir` and `rootDir`. The picker tries
 * the entry's JavaScript name under the common output roots, in order, and only
 * then takes the first `.js` key, so a sibling emit cannot shadow the entry
 * whenever the entry's key is one of the candidates.
 *
 * 1. Offer every candidate at once and remove the best one each round to see the
 *    order of preference.
 * 2. Offer only unrelated keys: the first JavaScript key wins, while declaration,
 *    source map and TypeScript keys never do.
 * 3. Map `.ts` and `.tsx` entry names, and a map with no JavaScript.
 *
 * @evidence contracts/testing.md#behavioral-verification pickEmittedJS prefers dist/playground.js for the default src-root layout, then dist/src/playground.js, dist/src/src/playground.js, src/src/playground.js and src/playground.js. It falls back to the first .js key, returns null when none exists and rejects declaration/map/source suffixes; distinct literal texts expose wrong priority.
 * @evidence contracts/testing.md#independent-expectations The documented default rootDir src/outDir dist makes src/playground.ts emit dist/playground.js before project-root layouts are considered. Authored distinct text values ROOT, A, X, C, D, E and F identify each selected key independently of the picker computation.
 * @evidence contracts/testing.md#distinguishing-cases Each candidate is removed in turn to show the next in order; a populated unrelated map contrasts with a candidate hit; declaration, map and TypeScript keys contrast with a JavaScript key; two entry extensions contrast; an empty and a JavaScript-free map return null.
 * @evidence contracts/testing.md#execution-ownership This entry calls only the pure pickEmittedJS function in the unit process with authored output maps; the service's use of the picked text is owned by test_playground_compile_interprets_build_envelopes.
 */
export function test_pick_emitted_js_prefers_the_entry_output_before_any_other_js(): void {
  const entry = "src/playground.ts";
  const output: Record<string, string> = {
    "other.js": "F",
    "src/playground.js": "D",
    "src/src/playground.js": "C",
    "dist/src/src/playground.js": "X",
    "dist/src/playground.js": "A",
    "dist/playground.js": "ROOT",
  };
  const order: [string, string][] = [
    ["dist/playground.js", "ROOT"],
    ["dist/src/playground.js", "A"],
    ["dist/src/src/playground.js", "X"],
    ["src/src/playground.js", "C"],
    ["src/playground.js", "D"],
  ];
  for (const [key, text] of order) {
    assert.equal(pickEmittedJS(output, entry), text, key);
    delete output[key];
  }
  assert.equal(pickEmittedJS(output, entry), "F", "the remaining .js file");

  assert.equal(
    pickEmittedJS(
      {
        "dist/playground.d.ts": "declaration",
        "dist/playground.js.map": "map",
        "dist/playground.ts": "source",
        "dist/playground.js": "E",
        "dist/zzz.js": "Z",
      },
      entry,
    ),
    "E",
    "a .js key beats declaration, map and source keys",
  );
  assert.equal(
    pickEmittedJS(
      { "dist/playground.d.ts": "d", "dist/playground.js.map": "m" },
      entry,
    ),
    null,
  );
  assert.equal(pickEmittedJS({}, entry), null);

  for (const [name, key] of [
    ["app/main.tsx", "app/main.js"],
    ["app/main.ts", "app/main.js"],
  ] as const)
    assert.equal(
      pickEmittedJS({ "z.js": "other", [key]: "entry" }, name),
      "entry",
      name,
    );
}
