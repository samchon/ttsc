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
//
// @evidence contracts/testing.md#behavioral-verification Fixes concatenation while retaining the string's escaped carriage return.
// @evidence contracts/testing.md#independent-expectations Literal expected \r spelling preserves U+000D in the resulting value and all source outside the replaced expression.
// @evidence contracts/testing.md#distinguishing-cases Carriage return differs from newline and delimiter escaping; the newline sibling owns the other control character.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplatePreservesCarriageReturn(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const foo = 1;\nconst s = \"a\\rb\" + foo;\nJSON.stringify(s);\n",
    "const foo = 1;\nconst s = `a\\rb${foo}`;\nJSON.stringify(s);\n",
  )
}
