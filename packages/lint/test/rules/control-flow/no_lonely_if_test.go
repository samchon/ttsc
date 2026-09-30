package linthost

import "testing"

// TestRuleCorpusNoLonelyIf verifies the lint rule corpus fixture no-lonely-if.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-lonely-if.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the sole if inside an else block and permits an else block with additional work.
// @evidence contracts/testing.md#independent-expectations An independently authored sibling statement prevents replacing the entire else block with an else-if continuation.
// @evidence contracts/testing.md#distinguishing-cases Original lone nested if reports; work before the nested if makes the block non-lone and stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoLonelyIf is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-lonely-if.ts through the owning Engine and assertRuleSkipsSource for the clean input. No installed consumer, native artifact build or real host runs.
func TestRuleCorpusNoLonelyIf(t *testing.T) {
  assertRuleCorpusCase(t, "no-lonely-if.ts", "function f(a: any, b: any) {\n  if (a) {\n    return 1;\n  } else {\n    // expect: no-lonely-if error\n    if (b) {\n      return 2;\n    }\n  }\n  return 0;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-lonely-if", "if (a) { use(a); } else { work(); if (b) { use(b); } }\n")
}
