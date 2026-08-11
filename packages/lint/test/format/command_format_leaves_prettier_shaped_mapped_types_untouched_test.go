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
