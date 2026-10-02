package linthost

import "testing"

// TestCommandFormatLeavesPrettierShapedTypeMembersUntouched pins the fixed
// point the member terminator must not cost.
//
// Reaching the always direction into type members risks the property the
// repository's format corpus measures: a file Prettier already formatted
// must produce zero edits. The two shapes that could regress are both
// here, an inline object type (whose bare last member is Prettier's own
// output) and a class accessor with a body (which Prettier never follows
// with `;`). The object-literal accessor, the third shape, is pinned at
// rule level in
// format_semi_keeps_braced_and_object_literal_accessors_bare_test.go.
//
//  1. Seed a Prettier 3.8.3-shaped file covering the member contexts.
//  2. Run `ttsc format`.
//  3. Assert the file is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one file with an interface (property, method, index signature), a broken and an inline object type alias, and a class with an index signature and a getter with a body, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The file is an authored literal in the layout the test comment attributes to Prettier 3.8.3 and serves as its own expected output.
// @evidence contracts/testing.md#distinguishing-cases Fixed-point cases for member contexts where a terminator must or must not appear (bare last member of an inline type, no `;` after a getter body). No unterminated input that must change is included, so a formatter that never edits members also passes.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatLeavesPrettierShapedTypeMembersUntouched(t *testing.T) {
  assertFormatUnchanged(t, `export interface Shape {
  value: string;
  method(): void;
  [key: string]: string;
}
export type Alias = {
  name: string;
};
export type Inline = { name: string };
export class Value {
  [key: string]: string;
  get first(): string {
    return "first";
  }
}
`)
}
