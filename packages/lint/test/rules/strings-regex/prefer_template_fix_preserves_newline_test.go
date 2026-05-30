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
func TestFixPreferTemplatePreservesNewline(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const foo = 1;\nconst s = \"a\\nb\" + foo;\nJSON.stringify(s);\n",
    "const foo = 1;\nconst s = `a\\nb${foo}`;\nJSON.stringify(s);\n",
  )
}
