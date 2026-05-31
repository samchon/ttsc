package linthost

import "testing"

// TestCommandFormatPreservesNestedVariableTypeLiteralIndent is a regression
// guard for the ordinary case the depth model handles correctly: a type
// literal annotating a variable, where the opening brace sits on the
// statement's own line so block depth equals the visual indent. The cede
// guards added for parameter / intersection / braceless positions must not
// regress this: format must keep the members at depth*tabWidth.
func TestCommandFormatPreservesNestedVariableTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `const config: {
  server: {
    port: number;
  };
} = { server: { port: 8080 } };
`)
}
