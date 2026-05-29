package linthost

import "testing"

// TestRuleCorpusTypescriptNoMisusedSpread verifies the lint rule corpus
// fixture typescript-no-misused-spread.ts.
//
// The AST-only subset of upstream `no-misused-spread` pins three
// syntactic mismatches without consulting the Checker:
//
//   - object literal spread inside an array literal,
//   - object literal spread as a call/`new` argument,
//   - array literal spread inside an object literal.
//
// Identifier operands stay opaque to the rule — only literal-shaped
// operands are reported, so generic iterability still needs the
// type-aware path.
//
//  1. Load the annotated TypeScript source embedded below.
//  2. Enable the rule severity declared by its `// expect:` comments.
//  3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusTypescriptNoMisusedSpread(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-misused-spread.ts",
    "// Positive: object literal spread inside an array literal.\n"+
      "// expect: typescript/no-misused-spread error\n"+
      "const fromArr = [...{ a: 1 }];\n"+
      "\n"+
      "// Positive: object literal spread as a call argument.\n"+
      "function take(...args: unknown[]): void {\n"+
      "  JSON.stringify(args);\n"+
      "}\n"+
      "// expect: typescript/no-misused-spread error\n"+
      "take(...{ a: 1 });\n"+
      "\n"+
      "// Positive: object literal spread as a `new` argument.\n"+
      "// expect: typescript/no-misused-spread error\n"+
      "const set = new Set(...{ a: 1 });\n"+
      "\n"+
      "// Positive: array literal spread inside an object literal.\n"+
      "// expect: typescript/no-misused-spread error\n"+
      "const fromObj = { ...[1, 2, 3] };\n"+
      "\n"+
      "// Negative: array spread inside array literal is fine.\n"+
      "const ok1 = [...[1, 2, 3]];\n"+
      "\n"+
      "// Negative: object spread inside object literal is fine.\n"+
      "const ok2 = { ...{ a: 1 } };\n"+
      "\n"+
      "// Negative: identifier spread is opaque to AST-only rule.\n"+
      "const items = [1, 2, 3];\n"+
      "const ok3 = [...items];\n"+
      "\n"+
      "JSON.stringify({ fromArr, fromObj, set, ok1, ok2, ok3 });\n")
}
