package linthost

import "testing"

// TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent guards a type
// literal that is a generic argument in a multi-line type-argument list
// (`Record<string, { … }>` broken one argument per line). The literal opens on
// an indented continuation line, so its members are indented relative to that
// line, not the block depth; format/indent must cede instead of de-indenting
// them. Contrast the single-line generic-arg guard, where the literal opens on
// the property's own line and the depth model is correct.
//
//  1. Exercise the authored command format preserves generic arg multiline type literal indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves generic arg multiline type literal indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a type literal that is a generic argument in a multi-line type-argument list (`Record<string, { … }>` broken one argument per line). The literal opens on an indented continuation line, so its members are indented relative to that line, not the block depth; format/indent must cede instead of de-indenting them. Contrast the single-line generic-arg guard, where the literal opens on the property's own line and the depth model is correct. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
