package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentRecognizesEveryECMAScriptSourceLineSeparator verifies that actual fix execution checks six named source-indent and parent-margin scenarios against authored full output.
//
// ECMAScript source line semantics independently distinguish CR, U+2028 and U+2029 as line boundaries for indentation inference.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks six named source-indent and parent-margin scenarios against authored full output.
// @evidence contracts/testing.md#independent-expectations ECMAScript source line semantics independently distinguish CR, U+2028 and U+2029 as line boundaries for indentation inference.
// @evidence contracts/testing.md#distinguishing-cases Each separator owns both surrounding-indent and parent-margin controls, with clean re-lint and named failure identity.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentRecognizesEveryECMAScriptSourceLineSeparator owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentRecognizesEveryECMAScriptSourceLineSeparator(t *testing.T) {
  separators := []struct {
    name string
    text string
  }{
    {name: "carriage-return", text: "\r"},
    {name: "line-separator", text: "\u2028"},
    {name: "paragraph-separator", text: "\u2029"},
  }
  for _, separator := range separators {
    t.Run(separator.name+"-source-indent", func(t *testing.T) {
      source := "if (ready) {" + separator.text + "\tuse();" + separator.text + "}" + separator.text +
        "const query = gql`\none\n`;\n"
      expected := "if (ready) {" + separator.text + "\tuse();" + separator.text + "}" + separator.text +
        "const query = gql`\n\tone\n`;\n"
      assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
    })

    t.Run(separator.name+"-parent-margin", func(t *testing.T) {
      source := "if (ready) {" + separator.text +
        "  const query = gql`\none\n`;" + separator.text +
        "}" + separator.text
      expected := "if (ready) {" + separator.text +
        "  const query = gql`\n    one\n  `;" + separator.text +
        "}" + separator.text
      assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
    })
  }
}
