package linthost

import "testing"

// TestCommandFormatPreservesNestedVariableTypeLiteralIndent is a regression
// guard for the ordinary case the depth model handles correctly: a type
// literal annotating a variable, where the opening brace sits on the
// statement's own line so block depth equals the visual indent. The cede
// guards added for parameter / intersection / braceless positions must not
// regress this: format must keep the members at depth*tabWidth.
//
//  1. Seed a variable annotated with a nested type literal.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `const config: { server: { port: number; }; } = { server: { port: 8080 } };` laid out with nested type-literal members at depth times tab width, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in Prettier's layout and is its own expected output.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case for the ordinary position where block depth equals the visual indent, guarding it against the cede rules added for parameter, intersection and braceless positions; no mis-indented input is repaired.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesNestedVariableTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `const config: {
  server: {
    port: number;
  };
} = { server: { port: 8080 } };
`)
}
