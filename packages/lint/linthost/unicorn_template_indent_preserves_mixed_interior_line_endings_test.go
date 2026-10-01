package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentPreservesMixedInteriorLineEndings verifies that the fixer compares authored mixed LF/CRLF output and checks clean re-lint.
//
// The supported preservation policy independently retains each interior separator rather than normalizing the whole source to one EOL.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares authored mixed LF/CRLF output and checks clean re-lint.
// @evidence contracts/testing.md#independent-expectations The supported preservation policy independently retains each interior separator rather than normalizing the whole source to one EOL.
// @evidence contracts/testing.md#distinguishing-cases The original interior LF and boundary CRLF distinction remains exact.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPreservesMixedInteriorLineEndings owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentPreservesMixedInteriorLineEndings(t *testing.T) {
  source := "if (ready) {\r\n  use();\n}\r\n" +
    "const query = gql`\r\n" +
    "one\n" +
    "  child\r\n" +
    "`;\r\n"
  expected := "if (ready) {\r\n  use();\n}\r\n" +
    "const query = gql`\r\n" +
    "  one\n" +
    "    child\r\n" +
    "`;\r\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if !strings.Contains(expected, "  one\n    child\r\n") {
    t.Fatal("mixed-EOL oracle must retain the interior LF and boundary CRLF")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}
