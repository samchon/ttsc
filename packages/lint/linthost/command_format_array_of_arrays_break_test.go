package linthost

import "testing"

// TestCommandFormatArrayOfArraysBreak pins Prettier's array shouldBreak
// heuristic: an array literal with more than one element, every element an
// array or object literal carrying more than one child, and consecutive
// elements of the same kind, explodes one element per line even when the array
// would fit flat. The boundary excludes single-child inners, mixed kinds, and
// a lone element.
//
// Each source is the Prettier-canonical output at printWidth 80.
//
//  1. Seed six array literals: pair arrays, `new Map([...])` entries,
//     two-property objects, single-child inner arrays, mixed kinds and a lone
//     element.
//  2. Run `ttsc format` on each and require the file to stay byte-identical to
//     its Prettier-canonical source.
//
// @evidence contracts/testing.md#behavioral-verification Seeds six authored array literals (pair arrays, `new Map([...])` entries, two-property objects, single-child inners, mixed kinds, a lone element), runs the in-process `format` command and requires each file unchanged.
// @evidence contracts/testing.md#independent-expectations Sources are authored literals in the Prettier-canonical layout the test names (multi-child same-kind elements broken one per line; others flat); expectations equal the inputs and are not derived from the implementation.
// @evidence contracts/testing.md#distinguishing-cases Three breaking positives (array of arrays, Map entries, array of objects) are contrasted with three flat negatives (single-child inners, mixed array and object, single element). All are fixed points, so the test cannot show the formatter performs the break from a flat input.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatArrayOfArraysBreak(t *testing.T) {
  // Array of two-element arrays: force break (the onEnter brackets shape).
  t.Run("array_of_pair_arrays_breaks", func(t *testing.T) {
    assertFormatUnchanged(t, `const a = [
  ["(", ")"],
  ["{", "}"],
  ["[", "]"],
];
`)
  })
  // The same inside a `new Map([...])` argument (the treeView shape).
  t.Run("map_entries_break", func(t *testing.T) {
    assertFormatUnchanged(t, `const b = new Map([
  ["view", this.id],
  ["viewItem", element.contextValue],
]);
`)
  })
  // Array of two-property objects: force break.
  t.Run("array_of_objects_breaks", func(t *testing.T) {
    assertFormatUnchanged(t, `const e = [
  { a: 1, b: 2 },
  { c: 3, d: 4 },
];
`)
  })
  // Single-child inner arrays stay flat (each inner has one element).
  t.Run("single_child_inners_stay_flat", func(t *testing.T) {
    assertFormatUnchanged(t, "const c = [[1], [2], [3]];\n")
  })
  // Mixed element kinds (array then object) stay flat.
  t.Run("mixed_kinds_stay_flat", func(t *testing.T) {
    assertFormatUnchanged(t, "const f = [[1, 2], { c: 3, d: 4 }];\n")
  })
  // A lone multi-child array element stays flat (needs two-plus elements).
  t.Run("single_element_stays_flat", func(t *testing.T) {
    assertFormatUnchanged(t, "const g = [[1, 2]];\n")
  })
}
