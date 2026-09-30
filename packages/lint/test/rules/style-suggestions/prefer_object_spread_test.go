package linthost

import "testing"

// TestRuleCorpusPreferObjectSpread verifies the lint rule corpus fixture
// prefer-object-spread.ts.
//
// The rule fires on `Object.assign({}, …)` calls whose first argument
// is an empty object literal. Mutating `Object.assign(target, …)` calls
// are intentionally left alone — the spread form does not preserve
// their observable behavior.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Reports Object.assign with an empty initial object while permitting object spread.
// @evidence contracts/testing.md#independent-expectations The authored empty-target shallow copy has a supported spread spelling; literal annotated old form and clean new form are independent.
// @evidence contracts/testing.md#distinguishing-cases Empty-target copy versus already-modern spread distinguishes the candidate from every Object.assign operation.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferObjectSpread(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-object-spread.ts", "declare const source: { x: number };\n// expect: prefer-object-spread error\nconst merged = Object.assign({}, source);\nJSON.stringify(merged);\n")
  assertRuleSkipsSource(t, "prefer-object-spread", "const merged = { ...source };\n")
}
