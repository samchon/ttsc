package linthost

import "testing"

// TestRuleCorpusUnicornNewForBuiltins verifies unicorn/new-for-builtins reports
// a call-form Array constructor that should use `new`.
//
// The rule splits built-ins into two groups: primitive wrappers must be called
// without `new`, while container constructors like Array must be called with
// `new`. This fixture pins the container branch with `Array(3)` — the canonical
// sparse-allocation footgun the rule exists to prevent.
//
// 1. Enable unicorn/new-for-builtins via an expect annotation.
// 2. Call `Array(3)` without `new`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Array is invoked as a function; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/new-for-builtins annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Array is invoked with new under this construction policy. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNewForBuiltins is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNewForBuiltins(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/new-for-builtins.ts", "// expect: unicorn/new-for-builtins error\nconst xs = Array(3);\nvoid xs;\n")
  assertRuleSkipsSource(t, "unicorn/new-for-builtins", "const xs = new Array(3);\n")
}
