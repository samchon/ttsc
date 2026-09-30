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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies process.exit terminates execution immediately; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-process-exit annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; process.exitCode reports the intended exit status without immediate exit. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoProcessExit is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoProcessExit(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-process-exit.ts", "// expect: unicorn/no-process-exit error\nprocess.exit(1);\n")
  assertRuleSkipsSource(t, "unicorn/no-process-exit", "process.exitCode = 1;\n")
}
