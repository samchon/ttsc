package linthost

import "testing"

// TestCommandFormatLeavesPrettierShapedTypeMembersUntouched pins the fixed
// point the member terminator must not cost.
//
// The authored file includes already-terminated interface and class members,
// a broken object type, a bare last member in an inline object type, and a
// getter with a body and no following terminator. The complete command must
// preserve all these bytes. It does not exercise missing-terminator insertion
// or invoke an independent formatter. An object-literal accessor has a
// separate rule-level fixture in
// format_semi_keeps_braced_and_object_literal_accessors_bare_test.go.
//
//  1. Seed the authored file covering these member contexts.
//  2. Run `ttsc format`.
//  3. Assert the file is byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on one file with an interface (property, method, index signature), a broken and an inline object type alias, and a class with an index signature and a getter with a body, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently requires preservation of member/type spellings, existing terminators and the getter body, including its return value. Agreement with an installed Prettier is not checked here.
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
