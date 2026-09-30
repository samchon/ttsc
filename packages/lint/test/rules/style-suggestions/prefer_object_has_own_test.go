package linthost

import "testing"

// TestRuleCorpusPreferObjectHasOwn verifies the lint rule corpus
// fixture prefer-object-has-own.ts.
//
// The rule fires on `Object.prototype.hasOwnProperty.call(...)` calls
// and suggests the ES2022 `Object.hasOwn(obj, key)` shorthand.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Reports Object.prototype.hasOwnProperty.call while permitting Object.hasOwn.
// @evidence contracts/testing.md#independent-expectations The supported safe ownership-query spelling is Object.hasOwn; authored legacy marker and modern-call zero control are independent.
// @evidence contracts/testing.md#distinguishing-cases Legacy borrowed-method call versus supported modern operation distinguish API shape, not merely the property name.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferObjectHasOwn(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-object-has-own.ts", "declare const target: { x: number };\n// expect: prefer-object-has-own error\nconst a = Object.prototype.hasOwnProperty.call(target, \"x\");\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "prefer-object-has-own", "const value = Object.hasOwn(target, \"x\");\n")
}
