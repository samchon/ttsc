package linthost

import "testing"

// TestRuleCorpusUnicornPreferModule verifies the rule reports a bare
// `require(...)` call.
//
// `require(...)` is the most common CommonJS construct the rule targets and
// the simplest to match — the callee is a bare identifier; no parent gating
// is needed. Locking the call-form branch here keeps the identifier-form
// branch (`__dirname` / `__filename`) free to evolve without re-pinning the
// primary fixture.
//
// 1. Enable unicorn/prefer-module via an expect annotation.
// 2. Call `require("path")` against a declared shim of the helper.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies require expresses a CommonJS load in an ESM-preference policy; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-module annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; an import declaration loads the same module using ESM. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferModule is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferModule(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-module.ts", "declare function require(name: string): unknown;\n// expect: unicorn/prefer-module error\nrequire(\"path\");\n")
  assertRuleSkipsSource(t, "unicorn/prefer-module", "import path from \"path\"; void path;\n")
}
