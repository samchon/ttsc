package linthost

import "testing"

// TestRuleCorpusUnicornConsistentDateClone verifies the rule fires on
// the redundant-`getTime()` clone shape.
//
// `new Date(other.getTime())` is the canonical wrong shape — the
// fixture exercises both the `Date` callee match and the
// `<x>.getTime()` zero-argument call shape on the new-expression's
// argument.
//
// 1. Enable unicorn/consistent-date-clone.
// 2. Declare `new Date(original.getTime())` against another `Date`.
// 3. Assert the new-expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies new Date(original.getTime()) unnecessarily extracts a timestamp; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/consistent-date-clone annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; new Date(original) uses the supported direct clone form. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornConsistentDateClone is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornConsistentDateClone(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/consistent-date-clone.ts", "const original = new Date();\n// expect: unicorn/consistent-date-clone error\nconst clone = new Date(original.getTime());\nvoid clone;\n")
  assertRuleSkipsSource(t, "unicorn/consistent-date-clone", "const original = new Date(); const clone = new Date(original);\n")
}
