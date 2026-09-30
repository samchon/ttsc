package linthost

import "testing"

// TestRuleCorpusNoUnsafeNegation verifies the lint rule corpus fixture no-unsafe-negation.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unsafe-negation.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports negation bound to the left operand of in while permitting negation of the whole membership result.
// @evidence contracts/testing.md#independent-expectations Operator precedence gives !a in b a different meaning from !(a in b); the authored annotation identifies that independent hazard.
// @evidence contracts/testing.md#distinguishing-cases The original left-operand negation reports; the parenthesized whole in result stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeNegation is selected in the shared Go unit population. It passes the authored no-unsafe-negation.ts fixture through assertRuleCorpusCase to the owning AST Engine and runs the additional clean source through assertRuleSkipsSource. No consumer install, native artifact build or real product host runs.
func TestRuleCorpusNoUnsafeNegation(t *testing.T) {
  assertRuleCorpusCase(t, "no-unsafe-negation.ts", "function f(a: any, b: any) {\n  // expect: no-unsafe-negation error\n  // @ts-ignore\n  return !a in b;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-unsafe-negation", "function f(a: any, b: any) { return !(a in b); }\n")
}
