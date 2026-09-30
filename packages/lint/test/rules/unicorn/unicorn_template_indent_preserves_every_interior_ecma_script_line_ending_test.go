package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentPreservesEveryInteriorECMAScriptLineEnding verifies that the actual fixer compares a full literal output retaining CR, LS and PS inside the template.
//
// ECMAScript permits these line separators and the supported preservation contract independently requires their original spelling with new indentation.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares a full literal output retaining CR, LS and PS inside the template.
// @evidence contracts/testing.md#independent-expectations ECMAScript permits these line separators and the supported preservation contract independently requires their original spelling with new indentation.
// @evidence contracts/testing.md#distinguishing-cases Interior CR/U+2028/U+2029 plus LF boundary lines retain their distinct separator positions.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPreservesEveryInteriorECMAScriptLineEnding owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentPreservesEveryInteriorECMAScriptLineEnding(t *testing.T) {
  source := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "one\r" +
    "  child\u2028" +
    "    grandchild\u2029" +
    "      last\n" +
    "`;\n"
  expected := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "  one\r" +
    "    child\u2028" +
    "      grandchild\u2029" +
    "        last\n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if !strings.Contains(expected, "one\r    child\u2028      grandchild\u2029        last") {
    t.Fatal("mixed ECMAScript line-ending oracle must retain every interior separator")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
