package linthost

import "testing"

// TestCommandFormatPreservesGenericArgTypeLiteralIndent is a regression guard
// for a type literal in a generic argument that is NOT inside a multi-line
// type operator: the literal opens on the property's own line, so block depth
// equals the visual indent and the depth model is correct. Format must keep
// the member at depth*tabWidth (contrast with the intersection case, where the
// literal opens on an indented `&`-chain line and must be ceded).
func TestCommandFormatPreservesGenericArgTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `declare namespace tags {
  type Plugin<T> = object;
}
interface X {
  id: tags.Plugin<{
    a: true;
  }>;
}
`)
}
