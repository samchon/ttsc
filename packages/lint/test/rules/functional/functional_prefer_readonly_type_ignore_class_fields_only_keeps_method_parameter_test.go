package linthost

import "testing"

// TestFunctionalPreferReadonlyTypeIgnoreClassFieldsOnlyKeepsMethodParameter verifies ignoreClass: "fieldsOnly" spares fields and keeps other class members checked.
//
// The negative twin, and the whole reason the option is not a boolean. A gate
// that treated any truthy value as the whole-body skip would silence the method
// parameter too, and the published type would then be a lie in its own second
// value.
//
// 1. Parse a class with a mutable array field and a mutable array parameter.
// 2. Enable only functional/prefer-readonly-type with `ignoreClass: "fieldsOnly"`.
// 3. Assert only the method parameter reports.
func TestFunctionalPreferReadonlyTypeIgnoreClassFieldsOnlyKeepsMethodParameter(t *testing.T) {
  const ruleName = "functional/prefer-readonly-type"
  findings := runFunctionalRuleWithOptions(
    t,
    ruleName,
    "class A {\n  values: string[] = [];\n  run(items: string[]): void {}\n}",
    "{\"ignoreClass\":\"fieldsOnly\"}",
  )
  assertFunctionalFinding(t, ruleName, findings, "readonly")
}
