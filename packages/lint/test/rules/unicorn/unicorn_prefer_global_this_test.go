package linthost

import "testing"

// TestRuleCorpusUnicornPreferGlobalThis verifies unicorn/prefer-global-this
// reports a bare `window` reference in value position.
//
// The rule's value-position gate is the most error-prone piece — a naive
// identifier visitor would also fire on `obj.window`, parameter names, and
// type references. A `void window;` statement is the minimal shape that
// passes the gate, pinning the canonical positive case.
//
// 1. Enable unicorn/prefer-global-this via an expect annotation.
// 2. Read the bare `window` identifier as a value expression.
// 3. Assert the identifier is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the window identifier denotes the platform-specific global object; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-global-this annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; globalThis denotes the portable global object. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferGlobalThis is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferGlobalThis(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-global-this.ts", "// expect: unicorn/prefer-global-this error\nvoid window;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-global-this", "void globalThis;\n")
}
