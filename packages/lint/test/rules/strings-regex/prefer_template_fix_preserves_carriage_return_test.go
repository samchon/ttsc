package linthost

import "testing"

// TestFixPreferTemplatePreservesCarriageReturn verifies the template-body
// escape branch keeps a literal's carriage return byte-for-byte.
//
// The fixer operates on the COOKED string value, so a raw CR emitted into a
// template body would be normalized to LF by the ECMAScript template-literal
// grammar — silently turning "a\rb" into a value whose cooked form is "a\nb".
// node --check still passes, so the corruption is invisible. The fixer must
// emit the CR as a `\r` escape so the rewritten template's cooked value is
// identical to the original concatenation.
//
//  1. Snapshot a concat whose literal's cooked value contains a carriage
//     return (written as a `\r` escape in source).
//  2. Apply `prefer-template` fix.
//  3. Assert the CR survives as a `\r` escape inside the template literal.
func TestFixPreferTemplatePreservesCarriageReturn(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const foo = 1;\nconst s = \"a\\rb\" + foo;\nJSON.stringify(s);\n",
    "const foo = 1;\nconst s = `a\\rb${foo}`;\nJSON.stringify(s);\n",
  )
}
