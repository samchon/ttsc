package linthost

import "testing"

// TestRuleCorpusUnicornConsistentAssert verifies the rule fires on a
// loose-equality `assert.equal(...)` call.
//
// The strict-variant policy is the rule's only behavior; pinning a
// single `assert.equal` invocation is enough to lock both the
// receiver-identifier check (`assert`) and the method-name allowlist
// (`equal` / `notEqual`).
//
// 1. Enable unicorn/consistent-assert via an expect annotation.
// 2. Call `assert.equal(1, 1)` after importing `node:assert`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornConsistentAssert(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/consistent-assert.ts", "import assert from \"node:assert\";\n// expect: unicorn/consistent-assert error\nassert.equal(1, 1);\n")
}
