package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing verifies that the fixer and actual casing helpers are compared with authored sharp-S and dotted-I outputs.
//
// JavaScript full Unicode casing independently expands sharp-S to SS and dotted-I to i plus combining dot; simple-rune casing would fail these literals.
//
// @evidence contracts/testing.md#behavioral-verification The fixer and actual casing helpers are compared with authored sharp-S and dotted-I outputs.
// @evidence contracts/testing.md#independent-expectations JavaScript full Unicode casing independently expands sharp-S to SS and dotted-I to i plus combining dot; simple-rune casing would fail these literals.
// @evidence contracts/testing.md#distinguishing-cases The sharp-S binding uses sharpSValue; upper-first sharp-S plus eta yields SSeta, and lower-first dotted-I plus tem yields i-combining-dot-tem.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const ß = 1;\nvoid ß;\n",
    `{"extendDefaultReplacements":false,"replacements":{"ß":{"sharpSValue":true}}}`,
    "const sharpSValue = 1;\nvoid sharpSValue;\n",
  )
  if actual := upperUnicornPreventAbbreviationsFirst("ßeta"); actual != "SSeta" {
    t.Fatalf("upper-first must use full Unicode casing: %q", actual)
  }
  if actual := lowerUnicornPreventAbbreviationsFirst("İtem"); actual != "i\u0307tem" {
    t.Fatalf("lower-first must use full Unicode casing: %q", actual)
  }
}
