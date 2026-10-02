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
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one file holding a broken mapped type, its `readonly`/`?` and `-readonly`/`-?` modifier forms, and a flat mapped type, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The file is an authored literal in the layout the test comment attributes to Prettier 3.8.3 and is its own expected output; agreement with an installed Prettier is not checked here.
// @evidence contracts/testing.md#distinguishing-cases Four mapped-type shapes as fixed points guard against a semicolon or sibling pass editing already-terminated or deliberately bare mapped-type members. No unterminated mapped type that must change is included here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
