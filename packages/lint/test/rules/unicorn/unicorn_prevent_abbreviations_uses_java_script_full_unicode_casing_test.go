package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing verifies that the fixer and actual casing helpers are compared with authored sharp-S and dotted-I outputs.
//
// JavaScript full Unicode casing independently expands sharp-S to SS and dotted-I to i plus combining dot; simple-rune casing would fail these literals.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The fixer and actual casing helpers are compared with authored sharp-S and dotted-I outputs.
// @evidence contracts/testing.md#independent-expectations JavaScript full Unicode casing independently expands sharp-S to SS and dotted-I to i plus combining dot; simple-rune casing would fail these literals.
// @evidence contracts/testing.md#distinguishing-cases The sharp-S binding uses sharpSValue; upper-first sharp-S plus eta yields SSeta, and lower-first dotted-I plus tem yields i-combining-dot-tem.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
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
