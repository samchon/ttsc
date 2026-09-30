package linthost

import "testing"

// TestCommandFormatPreservesIntersectionGenericTypeLiteralIndent guards the
// indentation of a type literal in a generic argument of an intersection
// member of a property type, the shape typia tag chains produce
// (`id: string & tags.Format<...> & tags.JsonSchemaPlugin<{ ... }>`). When the
// `&` chain breaks across lines, Prettier indents the type-literal members one
// level past the line that opens the literal and closes the brace at that
// line's column. The block-depth model counts only the interface body, so it
// would de-indent the members and brace; the formatter must keep the layout
// byte-identical.
//
//  1. Exercise the authored command format preserves intersection generic type literal indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves intersection generic type literal indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for the indentation of a type literal in a generic argument of an intersection member of a property type, the shape typia tag chains produce (`id: string & tags.Format<...> & tags.JsonSchemaPlugin<{ ... }>`). When the `&` chain breaks across lines, Prettier indents the type-literal members one level past the line that opens the literal and closes the brace at that line's column. The block-depth model counts only the interface body, so it would de-indent the members and brace; the formatter must keep the layout byte-identical. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesIntersectionGenericTypeLiteralIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesIntersectionGenericTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `declare namespace tags {
  type Format<S extends string> = object;
  type JsonSchemaPlugin<T> = object;
}
export interface IShoppingOrder {
  id: string &
    tags.Format<"uuid"> &
    tags.JsonSchemaPlugin<{
      "x-wrtn-payment-order-id": true;
    }>;
}
`)
}
