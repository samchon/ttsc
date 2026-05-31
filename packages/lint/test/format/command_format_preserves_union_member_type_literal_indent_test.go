package linthost

import "testing"

// TestCommandFormatPreservesUnionMemberTypeLiteralIndent guards type literals
// that are operands of a multi-line union type. Prettier indents each union
// member, and the members of a type-literal operand, relative to the operand
// line rather than the block depth; the formatter must keep the layout
// byte-identical instead of de-indenting the operand's members.
func TestCommandFormatPreservesUnionMemberTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `type T =
  | {
      a: number;
    }
  | {
      b: string;
    };
`)
}
