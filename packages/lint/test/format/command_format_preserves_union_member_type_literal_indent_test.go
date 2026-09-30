package linthost

import "testing"

// TestCommandFormatPreservesUnionMemberTypeLiteralIndent guards type literals
// that are operands of a multi-line union type. Prettier indents each union
// member, and the members of a type-literal operand, relative to the operand
// line rather than the block depth; the formatter must keep the layout
// byte-identical instead of de-indenting the operand's members.
//
//  1. Exercise the authored command format preserves union member type literal indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves union member type literal indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for type literals that are operands of a multi-line union type. Prettier indents each union member, and the members of a type-literal operand, relative to the operand line rather than the block depth; the formatter must keep the layout byte-identical instead of de-indenting the operand's members. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesUnionMemberTypeLiteralIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
