package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreClassFieldsOnlyKeepsMethodParameter verifies ignoreClass: "fieldsOnly" spares fields and keeps other class members checked.
//
// The reporting twin distinguishes the field-only and whole-class options. A gate
// that treated any truthy value as the whole-body skip would silence the method
// parameter too, and the published type would then be a lie in its own second
// value.
//
// 1. Parse a class with a mutable array field and a mutable array parameter.
// 2. Enable only functional/prefer-readonly-type with `ignoreClass: "fieldsOnly"`.
// 3. Assert only the method parameter reports.
//
// @evidence contracts/testing.md#behavioral-verification runFunctionalRuleWithOptions executes the actual engine and verifies class field is skipped but mutable method parameter still reports; assertFunctionalFinding requires exactly one finding carrying this rule identity, no autofix and a readonly message; the independently specified parameter-type range prevents accepting a report on the skipped field instead.
// @evidence contracts/testing.md#independent-expectations fieldsOnly narrows the exemption to fields rather than the whole class body. The literal source and configured option express the supported policy independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases IgnoreClassSkipsClassBody owns the whole-body switch.
// @evidence contracts/testing.md#execution-ownership TestFunctionalPreferReadonlyTypeIgnoreClassFieldsOnlyKeepsMethodParameter is a named Go unit entry running actual TypeScript AST policy operations in the shared engine process; no consumer install, native build or real product host is used.
func TestFunctionalPreferReadonlyTypeIgnoreClassFieldsOnlyKeepsMethodParameter(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "class A {\n  values: string[] = [];\n  run(items: string[]): void {}\n}",
    "{\"ignoreClass\":\"fieldsOnly\"}",
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
  const parameterTypeStart = len("class A {\n  values: string[] = [];\n  run(items: ")
  if findings[0].Pos != parameterTypeStart || findings[0].End != parameterTypeStart+len("string[]") {
    t.Fatalf("want method parameter type range [%d,%d), got [%d,%d)",
      parameterTypeStart, parameterTypeStart+len("string[]"), findings[0].Pos, findings[0].End)
  }
}
