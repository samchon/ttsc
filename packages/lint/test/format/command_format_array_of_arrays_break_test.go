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
//  1. Exercise the authored command format array of arrays break fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises array of arrays break and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: array_of_pair_arrays_breaks, map_entries_break, array_of_objects_breaks, single_child_inners_stay_flat, mixed_kinds_stay_flat, single_element_stays_flat. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatArrayOfArraysBreak owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
