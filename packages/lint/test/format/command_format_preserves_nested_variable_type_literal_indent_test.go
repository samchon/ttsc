package linthost

import "testing"

// TestCommandFormatPreservesNestedVariableTypeLiteralIndent is a regression
// guard for the ordinary case the depth model handles correctly: a type
// literal annotating a variable, where the opening brace sits on the
// statement's own line so block depth equals the visual indent. The cede
// guards added for parameter / intersection / braceless positions must not
// regress this: format must keep the members at depth*tabWidth.
//
//  1. Exercise the authored command format preserves nested variable type literal indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves nested variable type literal indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a regression guard for the ordinary case the depth model handles correctly: a type literal annotating a variable, where the opening brace sits on the statement's own line so block depth equals the visual indent. The cede guards added for parameter / intersection / braceless positions must not regress this: format must keep the members at depth*tabWidth. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesNestedVariableTypeLiteralIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesNestedVariableTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `const config: {
  server: {
    port: number;
  };
} = { server: { port: 8080 } };
`)
}
