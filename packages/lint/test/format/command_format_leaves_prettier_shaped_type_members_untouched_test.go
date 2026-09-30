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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises leaves prettier shaped type members untouched and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Assert the file is byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Seed a Prettier 3.8.3-shaped file covering the member contexts. The asserted decision is: Assert the file is byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatLeavesPrettierShapedTypeMembersUntouched owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
