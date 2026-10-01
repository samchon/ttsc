package linthost

import "testing"

// TestFixPreferTemplateIgnoresStringUnderOtherOperator verifies a
// string literal under a NON-`+` operator does not mark its chain
// string-like: `a * "x" + c + " s"` → “ `${"" + (a * "x" + c)} s` “.
//
// `a * "x"` coerces the string to a number, so `(a * "x") + c` may be
// numeric addition and must stay one `${"" + (…)}` slot. The containment gate
// only recurses through `+` (and parentheses); treating any descendant
// string literal as evidence would reintroduce the value corruption
// the gate exists to prevent, just one operator deeper.
//
// 1. Snapshot a chain whose only inner string sits under `*`.
// 2. Apply `prefer-template` fix.
// 3. Assert the non-string sub-chain stays a single slot.
//
// @evidence contracts/testing.md#behavioral-verification Fixes the outer concatenation without treating a string operand under multiplication as concatenation.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
// @evidence contracts/testing.md#independent-expectations ECMAScript multiplication and the preceding numeric addition remain one expression; the literal expected arithmetic slot preserves precedence.
// @evidence contracts/testing.md#distinguishing-cases A string inside * is not evidence of string-mode +, contrasting the leading-string flattening case.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateIgnoresStringUnderOtherOperator(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst c: any = 2;\nconst s = a * \"x\" + c + \" s\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst c: any = 2;\nconst s = `${\"\" + (a * \"x\" + c)} s`;\nJSON.stringify(s);\n",
  )
}
