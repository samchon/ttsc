package linthost

import "testing"

// TestRuleCorpusNoPlusplus verifies the lint rule corpus fixture no-plusplus.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-plusplus.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Reports postfix i++ while permitting an explicit i+=1 update.
// @evidence contracts/testing.md#independent-expectations The supported style policy forbids increment/decrement syntax; an authored annotation and additive-assignment zero control distinguish equivalent update styles.
// @evidence contracts/testing.md#distinguishing-cases Postfix positive contrasts with compound assignment without claiming this fixture covers every prefix/decrement case.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusNoPlusplus(t *testing.T) {
  assertRuleCorpusCase(t, "no-plusplus.ts", "let i = 0;\n// expect: no-plusplus error\ni++;\nJSON.stringify(i);\n")
  assertRuleSkipsSource(t, "no-plusplus", "let i = 0;\ni += 1;\n")
}
