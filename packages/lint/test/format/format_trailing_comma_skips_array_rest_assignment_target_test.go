package linthost

import "testing"

// TestFormatTrailingCommaSkipsArrayRestAssignmentTarget verifies the rule
// adds no trailing comma to a multi-line array destructuring assignment
// target ending in a rest (`[a, ...rest] = arr`).
//
// The array literal AST representation is shared by values and assignment targets. Only a target ending in rest forbids the comma, including nested and loop-initializer targets.
//
// 1. Parse standalone, nested and for-of/for-in array targets ending in rest.
// 2. Run the rule.
// 3. Assert zero findings, so no fix corrupts the source.
//
// @evidence contracts/testing.md#behavioral-verification The rule must leave array assignment targets ending in rest comma-free, including nested and loop-initializer targets. No-finding assertions prevent formatting valid targets into syntax errors.
// @evidence contracts/testing.md#independent-expectations ECMAScript assignment-rest grammar forbids a comma after the final rest element. Authored source has no such comma and must remain intact independently of the literal-expression AST representation.
// @evidence contracts/testing.md#distinguishing-cases The original standalone rest target remains; nested, for-of and for-in targets exercise ancestor ownership. ArraySpreadInValueLiteral and NonRestArrayAssignmentTarget provide legal comma positives.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsArrayRestAssignmentTarget owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaSkipsArrayRestAssignmentTarget(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "[\n  aa,\n  ...arest\n] = arr;\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "({ x: [\n  aa,\n  ...arest\n] } = obj);\n")
  assertRuleSkipsSource(t, "format/trailing-comma", "for ([\n  aa,\n  ...arest\n] of values) {}\n")
  assertRuleSkipsSource(t, "format/trailing-comma", "for ([\n  aa,\n  ...arest\n] in values) {}\n")
}
