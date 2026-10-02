package linthost

import "testing"

// TestCommandFormatLeavesPrettierShapedMappedTypesUntouched pins the fixed
// point the mapped-type terminator must not cost.
//
// The authored file contains three already-terminated broken mapped types,
// including readonly/optional and minus-modifier forms, and one flat bare
// mapped type. The full command must preserve their clauses and surrounding
// interface byte-for-byte. This fixed-point entry does not require insertion
// into an unterminated clause or establish agreement with another formatter.
// command_format_leaves_prettier_shaped_type_members_untouched_test.go owns
// a separate type-member preservation fixture.
//
//  1. Seed the authored file containing these four mapped-type shapes.
//  2. Run `ttsc format`.
//  3. Assert the file is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one file holding a broken mapped type, its `readonly`/`?` and `-readonly`/`-?` modifier forms, and a flat mapped type, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently specifies preservation of three terminated broken clauses, one bare flat clause and their interface/type declarations; agreement with an installed Prettier is not checked here.
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
