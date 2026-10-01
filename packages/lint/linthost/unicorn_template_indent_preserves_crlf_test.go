package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentPreservesCRLF verifies that actual fix execution compares complete authored CRLF output and requires clean re-lint.
//
// The supported line-ending preservation contract independently keeps CRLF while changing only indentation.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares complete authored CRLF output and requires clean re-lint.
// @evidence contracts/testing.md#independent-expectations The supported line-ending preservation contract independently keeps CRLF while changing only indentation.
// @evidence contracts/testing.md#distinguishing-cases CRLF outer/template lines retain their exact spelling; mixed and other ECMAScript separator hosts own broader boundaries.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPreservesCRLF owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentPreservesCRLF(t *testing.T) {
  source := "if (ready) {\r\n  use();\r\n}\r\n" +
    "const query = gql`\r\n" +
    "one\r\n" +
    "  child\r\n" +
    "`;\r\n"
  expected := "if (ready) {\r\n  use();\r\n}\r\n" +
    "const query = gql`\r\n" +
    "  one\r\n" +
    "    child\r\n" +
    "`;\r\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if strings.ReplaceAll(expected, "\r\n", "") == expected {
    t.Fatal("CRLF oracle must contain CRLF line endings")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
