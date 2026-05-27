package linthost

import "testing"

// TestRuleCorpusNoElseReturn verifies the lint rule corpus fixture
// no-else-return.ts.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoElseReturn(t *testing.T) {
	assertRuleCorpusCase(t, "no-else-return.ts", "// Positive: the `if` branch already ends in `return`, so the `else`\n// block adds nothing — flatten its body up into the function scope.\nfunction describe(kind: string): string {\n  if (kind === \"a\") {\n    return \"letter-a\";\n    // expect: no-else-return error\n  } else {\n    return \"other\";\n  }\n}\n\n// Negative: the `if` branch does not terminate, so the `else` is load-bearing.\nfunction classify(n: number): string {\n  let label: string;\n  if (n > 0) {\n    label = \"positive\";\n  } else {\n    label = \"non-positive\";\n  }\n  return label;\n}\n\nJSON.stringify({ describe: describe(\"a\"), classify: classify(1) });\n")
}
