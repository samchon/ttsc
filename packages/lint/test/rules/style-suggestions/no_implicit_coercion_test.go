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
//
// @evidence contracts/testing.md#behavioral-verification Reports value-producing !!value while allowing explicit Boolean(value).
// @evidence contracts/testing.md#independent-expectations The supported readability policy prefers named conversion to double negation; literal expect marker and explicit-conversion zero result are independent.
// @evidence contracts/testing.md#distinguishing-cases Value context distinguishes this policy from no-extra-boolean-cast's contextual redundancy rule.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusNoImplicitCoercion(t *testing.T) {
  assertRuleCorpusCase(t, "no-implicit-coercion.ts", "declare const value: unknown;\n// expect: no-implicit-coercion error\nconst asBool = !!value;\nJSON.stringify(asBool);\n")
  assertRuleSkipsSource(t, "no-implicit-coercion", "declare const value: unknown;\nconst explicit = Boolean(value);\n")
}
