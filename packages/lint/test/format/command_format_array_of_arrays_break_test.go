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
