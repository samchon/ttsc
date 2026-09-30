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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies node:assert equal uses coercive equality; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/consistent-assert annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; strictEqual retains the same imported receiver and operands. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornConsistentAssert is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornConsistentAssert(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/consistent-assert.ts", "import assert from \"node:assert\";\n// expect: unicorn/consistent-assert error\nassert.equal(1, 1);\n")
  assertRuleSkipsSource(t, "unicorn/consistent-assert", "import assert from \"node:assert\"; assert.strictEqual(1, 1);\n")
}
