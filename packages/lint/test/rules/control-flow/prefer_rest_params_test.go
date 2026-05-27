package linthost

import "testing"

// TestRuleCorpusPreferRestParams verifies the lint rule corpus fixture
// prefer-rest-params.ts.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusPreferRestParams(t *testing.T) {
	assertRuleCorpusCase(t, "prefer-rest-params.ts", "// Positive: a non-arrow function that reads from `arguments` should\n// declare its variadic contract as `(...args)` instead.\nfunction sumLegacy() {\n  // expect: prefer-rest-params error\n  return Array.prototype.slice.call(arguments).reduce(\n    (a: number, b: number) => a + b,\n    0,\n  );\n}\n\n// Negative: rest parameters express the variadic shape on the signature.\nfunction sumModern(...args: number[]) {\n  return args.reduce((a, b) => a + b, 0);\n}\n\n// Negative: arrow functions do not have their own `arguments`, so reads\n// here resolve to the enclosing function and the rule does not apply.\nconst passthrough = () => arguments;\n\nJSON.stringify({\n  legacy: sumLegacy.call(null, 1, 2),\n  modern: sumModern(1, 2),\n  passthrough: passthrough,\n});\n")
}
