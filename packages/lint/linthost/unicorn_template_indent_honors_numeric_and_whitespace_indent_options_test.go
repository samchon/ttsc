package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentHonorsNumericAndWhitespaceIndentOptions verifies that actual fix execution checks two named option payloads against their authored complete outputs and clean re-lint.
//
// The public indent schema independently permits numeric spaces and a literal whitespace string, establishing four-space and tab expectations.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution checks two named option payloads against their authored complete outputs and clean re-lint.
// @evidence contracts/testing.md#independent-expectations The public indent schema independently permits numeric spaces and a literal whitespace string, establishing four-space and tab expectations.
// @evidence contracts/testing.md#distinguishing-cases Numeric indent four and literal tab retain distinct expected margins while preserving relative child indentation.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentHonorsNumericAndWhitespaceIndentOptions owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentHonorsNumericAndWhitespaceIndentOptions(t *testing.T) {
  cases := []struct {
    name     string
    options  string
    expected string
  }{
    {
      name:    "numeric spaces",
      options: `{"indent":4}`,
      expected: "const query = gql`\n" +
        "    one\n" +
        "      child\n" +
        "`;\n",
    },
    {
      name:    "literal tab",
      options: `{"indent":"\t"}`,
      expected: "const query = gql`\n" +
        "\tone\n" +
        "\t  child\n" +
        "`;\n",
    },
  }
  source := "const query = gql`\n" +
    "one\n" +
    "  child\n" +
    "`;\n"
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, unicornTemplateIndentRuleName, source, test.options, test.expected)
      assertRuleSkipsSourceWithOptions(t, unicornTemplateIndentRuleName, test.expected, test.options)
    })
  }
}
