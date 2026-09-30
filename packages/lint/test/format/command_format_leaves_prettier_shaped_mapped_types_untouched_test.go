package linthost

import "testing"

// TestCommandFormatLeavesPrettierShapedMappedTypesUntouched pins the fixed
// point the mapped-type terminator must not cost.
//
// Reaching format/semi into a whole new kind risks the property the
// repository's format corpus measures: a file Prettier already formatted
// must produce zero edits. Every shape that could regress is here — a
// broken mapped type already terminated, its `readonly`/`?` and `-readonly`
// /`-?` modifier spellings, and a flat one whose bare clause is Prettier's
// own output — checked through the whole command rather than the rule
// alone, so a sibling pass reacting to the new byte would surface too. The
// member-shaped half of the same property is pinned in
// command_format_leaves_prettier_shaped_type_members_untouched_test.go.
//
//  1. Seed a Prettier 3.8.3-shaped file covering the mapped-type shapes.
//  2. Run `ttsc format`.
//  3. Assert the file is byte-identical.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises leaves prettier shaped mapped types untouched and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file is byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a Prettier 3.8.3-shaped file covering the mapped-type shapes. The asserted decision is: Assert the file is byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatLeavesPrettierShapedMappedTypesUntouched owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatLeavesPrettierShapedMappedTypesUntouched(t *testing.T) {
  assertFormatUnchanged(t, `export interface Shape {
  value: string;
}
export type Mapped = {
  [Key in keyof Shape]: Shape[Key];
};
export type Optional = {
  readonly [Key in keyof Shape]?: Shape[Key];
};
export type Stripped = {
  -readonly [Key in keyof Shape]-?: Shape[Key];
};
export type FlatMapped = { [Key in keyof Shape]: Shape[Key] };
`)
}
