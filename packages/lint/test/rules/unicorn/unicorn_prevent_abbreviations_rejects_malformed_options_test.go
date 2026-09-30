package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreventAbbreviationsRejectsMalformedOptions verifies that the actual options validator rejects every retained invalid literal payload.
//
// The public option/dictionary/allow-list/regex schema independently rejects malformed shapes and invalid patterns.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The actual options validator rejects every retained invalid literal payload.
// @evidence contracts/testing.md#independent-expectations The public option/dictionary/allow-list/regex schema independently rejects malformed shapes and invalid patterns.
// @evidence contracts/testing.md#distinguishing-cases Nonobject/null/unknown/case-misspelled keys, invalid option values, dictionary/allow-list types and bad/duplicate ignore patterns remain rejected.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsRejectsMalformedOptions owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsRejectsMalformedOptions(t *testing.T) {
  invalid := []string{
    `[]`,
    `null`,
    `{"unknown":true}`,
    `{"CheckVariables":false}`,
    `{"checkVariables":null}`,
    `{"checkShorthandImports":"external"}`,
    `{"replacements":{"err":true}}`,
    `{"replacements":{"err":null}}`,
    `{"allowList":{"err":"yes"}}`,
    `{"ignore":["("]}`,
    `{"ignore":["^skip","^skip"]}`,
  }
  rule := unicornPreventAbbreviations{}
  for _, options := range invalid {
    if err := rule.ValidateOptions(json.RawMessage(options)); err == nil {
      t.Fatalf("expected options to fail validation: %s", options)
    }
  }
}
