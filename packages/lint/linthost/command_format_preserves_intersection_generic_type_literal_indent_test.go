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
//  1. Seed an interface property typed as a broken `&` chain ending in a generic type literal.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface property typed as a broken `string & tags.Format<"uuid"> & tags.JsonSchemaPlugin<{ ... }>` intersection whose literal members sit one level past the opening line, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves the local namespace aliases, intersection order, uuid string type, generic argument and true-valued member with their existing indentation; it does not invoke Prettier or an installed typia consumer.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case where the literal opens on an indented `&` line, so a depth-only indent model would de-indent the members and closing brace; no wrongly indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
