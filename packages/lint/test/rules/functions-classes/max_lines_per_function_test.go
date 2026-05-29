package linthost

import "testing"

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
func TestRuleCorpusMaxLinesPerFunction(t *testing.T) {
  assertRuleCorpusCase(t, "max-lines-per-function.ts", "// Positive: the function body spans more than the default 50 lines\n// between its opening and closing braces, including the deliberate\n// blank-line padding below.\n// expect: max-lines-per-function error\nfunction longBody(): number {\n  let total = 0;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  total += 1;\n  return total;\n}\n\n// Negative: a single-line function trivially fits under the limit.\nfunction short(): number {\n  return 0;\n}\n\nJSON.stringify({\n  longBody: longBody(),\n  short: short(),\n});\n")
}
