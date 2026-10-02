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
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves both nested type frames, the port number type and the corresponding value 8080 with their existing indentation; no independent Prettier invocation establishes these bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed point where both type-literal opening lines match block-depth indentation. It protects correct nested source from edits, but an implementation that cedes every type literal also passes; no mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesNestedVariableTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `const config: {
  server: {
    port: number;
  };
} = { server: { port: 8080 } };
`)
}
