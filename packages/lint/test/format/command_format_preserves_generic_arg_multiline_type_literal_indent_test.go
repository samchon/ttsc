package linthost

import "testing"

// TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent guards a type
// literal that is a generic argument in a multi-line type-argument list
// (`Record<string, { … }>` broken one argument per line). The literal opens on
// an indented continuation line, so its members are indented relative to that
// line, not the block depth; format/indent must cede instead of de-indenting
// them. Contrast the single-line generic-arg guard, where the literal opens on
// the property's own line and the depth model is correct.
func TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `type T = Record<
  string,
  {
    a: number;
    b: string;
  }
>;
`)
}
