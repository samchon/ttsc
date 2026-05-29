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
func TestRuleCorpusUnicornPreferModule(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-module.ts", "declare function require(name: string): unknown;\n// expect: unicorn/prefer-module error\nrequire(\"path\");\n")
}
