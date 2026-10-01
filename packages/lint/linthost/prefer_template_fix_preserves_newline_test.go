package linthost

import "testing"

// TestFixPreferTemplatePreservesNewline verifies the template-body escape
// branch keeps a literal's newline as a `\n` escape rather than a raw LF.
//
// Emitting the cooked LF raw would still parse, but it would reshape the
// template into a multi-line literal whose source layout no longer matches
// the original single-line concat. Escaping it as `\n` keeps both the cooked
// value and the on-one-line source shape stable.
//
//  1. Snapshot a concat whose literal contains a newline.
//  2. Apply `prefer-template` fix.
//  3. Assert the newline survives as a `\n` escape inside the template.
//
// @evidence contracts/testing.md#behavioral-verification Fixes concatenation while retaining the string's escaped newline.
// @evidence contracts/testing.md#independent-expectations Literal expected \n spelling preserves U+000A in the value and all source outside the replaced expression.
// @evidence contracts/testing.md#distinguishing-cases Newline contrasts with carriage return and ordinary literal text.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplatePreservesNewline(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const foo = 1;\nconst s = \"a\\nb\" + foo;\nJSON.stringify(s);\n",
    "const foo = 1;\nconst s = `a\\nb${foo}`;\nJSON.stringify(s);\n",
  )
}
