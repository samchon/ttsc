package linthost

import "testing"

// TestFormatTrailingCommaSkipsUnparenthesizedArrowWithMultilineBody verifies
// the rule does not insert a trailing comma after the parameter of an
// unparenthesized single-parameter arrow whose body spans multiple lines.
//
// A closing parenthesis later in an arrow body cannot serve as its parameter-list delimiter. Both standalone and call-wrapped unparenthesized arrows must abstain.
//
//  1. Parse standalone and call-wrapped unparenthesized arrows whose bodies
//     contain an unrelated closing parenthesis on a later line.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Assert zero findings. The inner call already carries its own trailing
//     comma, so silence on the arrow's parameter list is the entire signal.
//
// @evidence contracts/testing.md#behavioral-verification An unparenthesized arrow parameter must never gain a comma based on a closing parenthesis inside its multiline body. Both standalone and outer-call forms must produce no findings.
// @evidence contracts/testing.md#independent-expectations ECMAScript unparenthesized arrow syntax has one binding and no parameter-list comma position. The authored valid sources retain their inner call commas and independently require no parameter edit.
// @evidence contracts/testing.md#distinguishing-cases The original standalone arrow stays, and an added map-call wrapper places an unrelated later close parenthesis after the arrow. Parenthesized multi-parameter insertion supplies the eligible counterpart.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsUnparenthesizedArrowWithMultilineBody owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
func TestFormatTrailingCommaSkipsUnparenthesizedArrowWithMultilineBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "declare function foo(x: number): number;\nconst f = a => {\n  return foo(\n    a,\n  );\n};\nf;\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "const result = xs.map(a => {\n  return foo(\n    a,\n  );\n});\n")
}
