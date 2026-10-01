package linthost

import "testing"

// TestFormatTrailingCommaSkipsObjectRestAssignmentTarget verifies the rule
// adds no trailing comma to a multi-line object destructuring assignment
// target ending in a rest (`({ a, ...rest } = obj)`).
//
// Object rest at the end of an assignment target differs from value-position spread. Nested targets and loop initializers must retain that grammar distinction.
//
// 1. Parse standalone, nested and for-of/for-in object targets ending in rest.
// 2. Run the rule.
// 3. Assert zero findings, so no fix rewrites the source into invalid syntax.
//
// @evidence contracts/testing.md#behavioral-verification The rule must keep object assignment targets ending in rest comma-free, including a nested target and loop initializer. Absence assertions detect producing an invalid comma after the rest property.
// @evidence contracts/testing.md#independent-expectations ECMAScript object-assignment rest-property grammar forbids a following comma. The authored valid targets independently determine no change, irrespective of the AST spread-assignment node kind.
// @evidence contracts/testing.md#distinguishing-cases The original standalone rest target remains with nested and for-of/for-in variants. ObjectSpreadInValueLiteral and NonRestObjectAssignmentTarget supply legal value and non-rest target positives.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsObjectRestAssignmentTarget owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaSkipsObjectRestAssignmentTarget(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "({\n  ra,\n  ...rrest\n} = obj);\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "[{\n  ra,\n  ...rrest\n}] = arr;\n")
  assertRuleSkipsSource(t, "format/trailing-comma", "for ({\n  ra,\n  ...rrest\n} of values) {}\n")
  assertRuleSkipsSource(t, "format/trailing-comma", "for ({\n  ra,\n  ...rrest\n} in values) {}\n")
}
