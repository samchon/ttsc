package linthost

import "testing"

// TestRuleCorpusMaxDepth verifies the lint rule corpus fixture max-depth.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-depth.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusMaxDepth(t *testing.T) {
  assertRuleCorpusCase(t, "max-depth.ts", "// Positive: five levels of block nesting (if > for > while > if > if)\n// exceed the default ceiling of four. The innermost `if` is the level\n// that crosses the threshold so the diagnostic pins to it.\nfunction deep(values: ReadonlyArray<number>): number {\n  let total = 0;\n  if (values.length > 0) {\n    for (const value of values) {\n      while (total < 100) {\n        if (value > 0) {\n          // expect: max-depth error\n          if (value % 2 === 0) {\n            total += value;\n          }\n        }\n        total += 1;\n      }\n    }\n  }\n  return total;\n}\n\n// Negative: a flat function with no nested blocks stays well under the\n// limit.\nfunction shallow(value: number): number {\n  return value + 1;\n}\n\nJSON.stringify({\n  deep: deep([1, 2, 3]),\n  shallow: shallow(0),\n});\n")
}
