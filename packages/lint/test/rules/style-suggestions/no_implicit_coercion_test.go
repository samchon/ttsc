package linthost

import "testing"

// TestRuleCorpusNoImplicitCoercion verifies the lint rule corpus
// fixture no-implicit-coercion.ts.
//
// The rule catches `!!x`, `+x`, `"" + x`, and `x + ""` coercion idioms
// in favor of the explicit `Boolean(x)` / `Number(x)` / `String(x)`
// conversions.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoImplicitCoercion(t *testing.T) {
	assertRuleCorpusCase(t, "no-implicit-coercion.ts", "declare const value: unknown;\n// expect: no-implicit-coercion error\nconst asBool = !!value;\nJSON.stringify(asBool);\n")
}
