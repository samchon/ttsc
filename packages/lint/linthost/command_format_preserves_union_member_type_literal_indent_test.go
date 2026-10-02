package linthost

import "testing"

// TestCommandFormatPreservesUnionMemberTypeLiteralIndent guards type literals
// that are operands of a multi-line union type. Prettier indents each union
// member, and the members of a type-literal operand, relative to the operand
// line rather than the block depth; the formatter must keep the layout
// byte-identical instead of de-indenting the operand's members.
//
//  1. Seed a union of two type-literal operands on separate `|` lines.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `type T =` with two type-literal union operands written on separate `|` lines, each with its members indented relative to the operand position, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves union order, both number/string member types, bar positions and existing indentation; no independent Prettier invocation establishes the expected bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case guarding multi-line union operands against de-indentation to block depth; no mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
