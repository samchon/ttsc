package linthost

import "testing"

// TestRuleCorpusUnicornNoProcessExit verifies unicorn/no-process-exit reports
// a bare `process.exit(...)` callsite.
//
// This is the minimal positive case for the typed-accessor walk: the rule
// resolves a `CallExpression` to its `PropertyAccessExpression` callee and
// identifier-text-compares both sides (`process` and `exit`). The fixture
// pins that path so regressions in node-kind dispatch or in the
// `AsPropertyAccessExpression` accessor surface immediately.
//
// 1. Enable unicorn/no-process-exit via an expect annotation.
// 2. Invoke `process.exit(1)` at the top level.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoProcessExit(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-process-exit.ts", "// expect: unicorn/no-process-exit error\nprocess.exit(1);\n")
}
