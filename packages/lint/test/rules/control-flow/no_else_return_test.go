package linthost

import "testing"

// TestRuleCorpusNoElseReturn verifies the lint rule corpus fixture
// no-else-return.ts.
//
// The fixture pins the issue #598 matrix in one file: a plain `else` after a
// returning `if` and a three-branch `return` chain each report once, while a
// `return` + `else if` chain and `throw` / `break` / `continue` before an
// `else` stay silent (only `return` is a terminator; `allowElseIf` defaults to
// true).
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoElseReturn(t *testing.T) {
  assertRuleCorpusCase(t, "no-else-return.ts", "// no-else-return corpus (issue #598). Only a `return` makes the matching\n// `else` redundant; `throw` / `break` / `continue` do not, and `allowElseIf`\n// (default true) leaves a `return` + `else if` chain alone.\n\n// Invalid: the `if` branch returns, so the plain `else` block is redundant.\nfunction describe(kind: string): string {\n  if (kind === \"a\") {\n    return \"letter-a\";\n    // expect: no-else-return error\n  } else {\n    return \"other\";\n  }\n}\n\n// Invalid: a three-branch `return` chain reports exactly once — on the\n// terminal `else`, not once per link.\nfunction grade(score: number): string {\n  if (score >= 90) return \"A\";\n  else if (score >= 80) return \"B\";\n  // expect: no-else-return error\n  else return \"C\";\n}\n\n// Valid: `allowElseIf` (default true) leaves a `return` + `else if` chain\n// that ends without a plain `else` alone.\nfunction classifySign(n: number): string {\n  if (n > 0) {\n    return \"positive\";\n  } else if (n < 0) {\n    return \"negative\";\n  }\n  return \"zero\";\n}\n\n// Valid: `throw` is not a `return`, so the `else` is load-bearing.\nfunction requirePositive(n: number): number {\n  if (n <= 0) {\n    throw new Error(\"non-positive\");\n  } else {\n    return n;\n  }\n}\n\n// Valid: a loop `break` is not a `return`.\nfunction firstBreakIndex(values: boolean[]): number {\n  let last = -1;\n  for (let i = 0; i < values.length; i++) {\n    if (values[i]) {\n      break;\n    } else {\n      last = i;\n    }\n  }\n  return last;\n}\n\n// Valid: a loop `continue` is not a `return`.\nfunction countFalsy(values: boolean[]): number {\n  let count = 0;\n  for (let i = 0; i < values.length; i++) {\n    if (values[i]) {\n      continue;\n    } else {\n      count += 1;\n    }\n  }\n  return count;\n}\n\n// Negative: the `if` branch does not return, so the `else` is load-bearing.\nfunction classify(n: number): string {\n  let label: string;\n  if (n > 0) {\n    label = \"positive\";\n  } else {\n    label = \"non-positive\";\n  }\n  return label;\n}\n\nJSON.stringify({\n  describe: describe(\"a\"),\n  grade: grade(95),\n  classifySign: classifySign(1),\n  requirePositive: requirePositive(1),\n  firstBreakIndex: firstBreakIndex([true]),\n  countFalsy: countFalsy([false]),\n  classify: classify(1),\n});\n")
}
