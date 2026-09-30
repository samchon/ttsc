package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusMaxLinesPerFunction verifies the lint rule corpus fixture max-lines-per-function.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-lines-per-function.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original body exceeding fifty source lines and permits a body spanning exactly fifty lines.
// @evidence contracts/testing.md#independent-expectations The default fifty-line limit and independently constructed newline count supply the line-span oracle, including blank padding.
// @evidence contracts/testing.md#distinguishing-cases The original long function reports; exactly fifty lines and the original short function stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusMaxLinesPerFunction is selected in the shared Go unit population. It calls assertRuleCorpusCase with max-lines-per-function.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusMaxLinesPerFunction(t *testing.T) {
  assertRuleCorpusCase(t, "max-lines-per-function.ts", "// Positive: the function body spans more than the default 50 lines\n// between its opening and closing braces, including the deliberate\n// blank-line padding below.\n// expect: max-lines-per-function error\nfunction longBody(): number {\n  let total = 0;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  return total;\n}\n\n// Negative: a single-line function trivially fits under the limit.\nfunction short(): number {\n  return 0;\n}\n\nJSON.stringify({\n  longBody: longBody(),\n  short: short(),\n});\n")
  assertRuleSkipsSource(t, "max-lines-per-function", "function atLimit() {\n" + strings.Repeat("\n", 48) + "}\n")
}
