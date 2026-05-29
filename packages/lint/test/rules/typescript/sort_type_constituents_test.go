package linthost

import "testing"

// TestRuleCorpusTypescriptSortTypeConstituents verifies the lint rule
// corpus fixture typescript-sort-type-constituents.ts.
//
// The AST-only baseline pins the syntactic cases: primitive keywords
// alphabetized first, named references alphabetized next, `null` and
// `undefined` last. A type whose constituents do not match that order
// fires once on the surrounding union or intersection node — the
// autofixer rewrites the whole list together, so per-constituent
// reports would be noise.
//
//  1. Load the annotated TypeScript fixture source embedded below.
//  2. Enable the rule severities declared by its `// expect:` comments.
//  3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusTypescriptSortTypeConstituents(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-sort-type-constituents.ts",
    "// Positive: primitives out of alphabetical order — `string` should\n"+
      "// come after `number`.\n"+
      "// expect: typescript/sort-type-constituents error\n"+
      "type OutOfOrderPrimitives = string | number;\n"+
      "\n"+
      "// Positive: `null` listed before a non-nullish constituent.\n"+
      "// expect: typescript/sort-type-constituents error\n"+
      "type NullFirst = null | string;\n"+
      "\n"+
      "// Negative: already in canonical order.\n"+
      "type Ok1 = number | string;\n"+
      "type Ok2 = string | null;\n"+
      "\n"+
      "declare const samples: [OutOfOrderPrimitives, NullFirst, Ok1, Ok2];\n"+
      "JSON.stringify(samples);\n")
}
