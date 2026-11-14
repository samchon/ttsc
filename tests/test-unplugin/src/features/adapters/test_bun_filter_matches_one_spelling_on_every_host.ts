import assert from "node:assert/strict";

import { createBunFilter } from "../../../../../packages/unplugin/src/core/bun/createBunFilter";

/**
 * Verifies the Bun `filter` option selects by path alone and spells paths one
 * way on every host.
 *
 * A global or sticky RegExp moves `lastIndex` on every test, so the same module
 * would alternate between selected and skipped. Windows delivers backslash
 * paths, which a pattern written with `/` would never match. The compiled
 * filter must answer from the path and the pattern text alone, and the option
 * must say what no filter means.
 *
 * 1. Compile no filter and an empty list, and assert both skip nothing.
 * 2. Test POSIX and Windows spellings of one file against one `/` pattern.
 * 3. Test global and sticky patterns repeatedly and in alternation, and assert the
 *    caller's pattern keeps its own `lastIndex`.
 * 4. Test alternatives, case sensitivity and its `i` flag, and reject entries that
 *    are not a RegExp.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The real createBunFilter returns no predicate for undefined and an empty list,
 *   selects the POSIX and Windows spellings of one file with one pattern,
 *   answers a global and a sticky pattern identically on every repeat and
 *   alternation, leaves the caller's lastIndex alone, ORs alternatives,
 *   honors the i flag and throws TypeError for non-RegExp entries.
 * @evidence contracts/testing.md#independent-expectations
 *   Literal paths and patterns define each answer, including `C:\project\src\a.ts`
 *   for the Windows spelling; no expected value is computed with the separator
 *   conversion function or RegExp copy.
 * @evidence contracts/testing.md#distinguishing-cases
 *   POSIX versus Windows spelling, global and sticky versus plain flags, match
 *   versus miss in alternation, one pattern versus a list, case-sensitive versus
 *   the i flag, valid versus non-RegExp entries.
 * @evidence contracts/testing.md#execution-ownership
 *   The unit runner calls the authored source function directly with literal
 *   strings and patterns. It converts a Windows spelling inside the string under
 *   test on any host, so no Windows runner, filesystem, native producer or
 *   Bun host runs; reads and the loader's skip response belong to test_bun_filter_leaves_unselected_modules_to_bun.
 */
export function test_bun_filter_matches_one_spelling_on_every_host(): void {
  assert.equal(createBunFilter(undefined), undefined);
  assert.equal(createBunFilter([]), undefined);

  const posix = "/project/src/a.ts";
  const windows = "C:\\project\\src\\a.ts";
  const source = createBunFilter(/\/src\/a\.ts$/);
  assert.ok(source);
  assert.equal(source(posix), true);
  assert.equal(source(windows), true);
  assert.equal(source("/project/src/b.ts"), false);

  const global = /a\.ts$/g;
  global.lastIndex = 5;
  const sticky = /\/project\//y;
  for (const pattern of [global, sticky]) {
    const filter = createBunFilter(pattern);
    assert.ok(filter);
    for (let attempt = 0; attempt < 4; ++attempt) {
      assert.equal(filter(posix), true, `repeat ${attempt} must still select`);
      assert.equal(filter("/other/b.ts"), false);
    }
  }
  assert.equal(global.lastIndex, 5, "the caller's pattern must stay untouched");

  const alternatives = createBunFilter([/\/a\.ts$/, /\/b\.ts$/]);
  assert.ok(alternatives);
  assert.equal(alternatives("/project/src/a.ts"), true);
  assert.equal(alternatives("/project/src/b.ts"), true);
  assert.equal(alternatives("/project/src/c.ts"), false);

  assert.equal(createBunFilter(/\/SRC\//)!(posix), false);
  assert.equal(createBunFilter(/\/SRC\//i)!(posix), true);

  assert.throws(
    () => createBunFilter("a.ts" as never),
    new TypeError(
      "@ttsc/unplugin filter must be a RegExp or an array of RegExp.",
    ),
  );
  assert.throws(() => createBunFilter([/a/, "b"] as never), TypeError);
}
