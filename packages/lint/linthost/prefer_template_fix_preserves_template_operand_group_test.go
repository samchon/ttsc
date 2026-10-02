package linthost

import "testing"

// TestFixPreferTemplatePreservesTemplateOperandGroup verifies that
// `a + `x${y}` + "s"` keeps `a + `x${y}`` as one interpolation.
//
// An effectful right template must finish before the left object is coerced.
// The fix preserves the complete a + template addition in one interpolation,
// and moves only the inert trailing string into the outer template's literal body.
//
// 1. Snapshot a chain whose second operand is a template literal with a substitution.
// 2. Apply `prefer-template` fix.
// 3. Assert the output groups `a` and the template in one slot followed by `s`.
//
// @evidence contracts/testing.md#behavioral-verification Real edits preserve the original a-plus-template grouping and its inner y substitution while moving the suffix into one outer template.
// @evidence contracts/testing.md#independent-expectations Binary addition evaluates both operands before default-hint coercion. The literal full output retains that order instead of coercing a before the right template runs.
// @evidence contracts/testing.md#distinguishing-cases A right template expression requires grouped preservation; inert right string literals and string-leading chains permit separate slots in companion tests.
// @evidence contracts/testing.md#execution-ownership This Go unit applies actual Engine edits to the authored disk-backed fixture through assertFixSnapshot without installing a consumer or launching a native host.
func TestFixPreferTemplatePreservesTemplateOperandGroup(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst y: any = 2;\nconst s = a + `x${y}` + \"s\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst y: any = 2;\nconst s = `${\"\" + (a + `x${y}`)}s`;\nJSON.stringify(s);\n",
  )
}
