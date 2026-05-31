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
