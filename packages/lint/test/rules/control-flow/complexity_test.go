package linthost

import "testing"

// TestRuleCorpusComplexity verifies the lint rule corpus fixture complexity.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in complexity.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusComplexity(t *testing.T) {
  assertRuleCorpusCase(t, "complexity.ts", "// expect: complexity error\nfunction tooComplex(input: number): string {\n  // Base complexity is 1. The body below adds 24 more branching points\n  // for a final score of 25 — comfortably above the configured limit\n  // of 20.\n  if (input === 0) return \"zero\";\n  if (input === 1) return \"one\";\n  if (input === 2) return \"two\";\n  if (input === 3) return \"three\";\n  if (input === 4) return \"four\";\n  if (input === 5) return \"five\";\n  if (input === 6) return \"six\";\n  if (input === 7) return \"seven\";\n  if (input === 8) return \"eight\";\n  if (input === 9) return \"nine\";\n  if (input === 10) return \"ten\";\n  if (input > 100 && input < 200) return \"hundreds\";\n  if (input > 200 || input < -200) return \"extreme\";\n  if (input === null || input === undefined) return \"missing\";\n  const tag = input > 0 ? \"positive\" : \"negative\";\n  const fallback = input ?? 0;\n  switch (fallback) {\n    case 11:\n      return \"eleven\";\n    case 12:\n      return \"twelve\";\n    case 13:\n      return \"thirteen\";\n    case 14:\n      return \"fourteen\";\n    default:\n      break;\n  }\n  try {\n    return tag + String(fallback);\n  } catch {\n    return \"error\";\n  }\n}\n\n// Negative: stays under the limit, so the rule must not fire.\nfunction simple(value: number): number {\n  if (value < 0) return 0;\n  return value + 1;\n}\n\nJSON.stringify({\n  tooComplex: tooComplex(7),\n  simple: simple(2),\n});\n")
}
