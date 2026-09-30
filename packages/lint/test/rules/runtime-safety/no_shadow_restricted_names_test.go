package linthost

import "testing"

// TestRuleCorpusNoShadowRestrictedNames verifies the lint rule corpus fixture no-shadow-restricted-names.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-shadow-restricted-names.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the undefined parameter binding while permitting an ordinary parameter name.
// @evidence contracts/testing.md#independent-expectations The restricted-global-name binding policy supplies the authored undefined-parameter diagnostic independently of its body use.
// @evidence contracts/testing.md#distinguishing-cases A restricted undefined parameter reports; a value parameter remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoShadowRestrictedNames is selected in the shared Go unit population. It passes the authored no-shadow-restricted-names.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoShadowRestrictedNames(t *testing.T) {
  assertRuleCorpusCase(t, "no-shadow-restricted-names.ts", "// expect: no-shadow-restricted-names error\nfunction f(undefined: number) {\n  return undefined;\n}\nf(1);\n")
  assertRuleSkipsSource(t, "no-shadow-restricted-names", "function f(value: number) { return value; }\n")
}
