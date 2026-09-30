package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornPreferNumberPropertiesValidatesOptions locks the public option
// schema: only the boolean checkInfinity / checkNaN keys are accepted, and the
// checker requirement survives every valid shape.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The actual options validator accepts supported booleans and rejects malformed payloads instead of silently disabling the rule.
// @evidence contracts/testing.md#independent-expectations The public checkInfinity/checkNaN boolean schema independently establishes the literal valid/invalid option forms.
// @evidence contracts/testing.md#distinguishing-cases Retained legal boolean forms and malformed shapes remain distinct; enabled and default hosts verify the resulting lint behavior.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesValidatesOptions owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesValidatesOptions(t *testing.T) {
  valid := []json.RawMessage{
    nil,
    json.RawMessage(`{}`),
    json.RawMessage(`{"checkInfinity":true}`),
    json.RawMessage(`{"checkNaN":false}`),
    json.RawMessage(`{"checkInfinity":true,"checkNaN":true}`),
  }
  for _, options := range valid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornPreferNumberPropertiesRuleName: SeverityError},
      Options: RuleOptionsMap{unicornPreferNumberPropertiesRuleName: options},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("valid options %s were rejected: %v", options, err)
    }
    if !engine.NeedsTypeChecker() {
      t.Fatalf("valid options %s lost the checker requirement", options)
    }
  }

  invalid := []struct {
    options json.RawMessage
    want    string
  }{
    {options: json.RawMessage(`null`), want: "options must be an object"},
    {options: json.RawMessage(`[]`), want: "options must be an object"},
    {options: json.RawMessage(`{"checkInfinity":null}`), want: `option "checkInfinity" must be a boolean`},
    {options: json.RawMessage(`{"checkNaN":"yes"}`), want: `option "checkNaN" must be a boolean`},
    {options: json.RawMessage(`{"unknown":true}`), want: `unknown option "unknown"`},
  }
  for _, test := range invalid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornPreferNumberPropertiesRuleName: SeverityError},
      Options: RuleOptionsMap{unicornPreferNumberPropertiesRuleName: test.options},
    })
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), test.want) {
      t.Fatalf("invalid options %s mismatch: want %q, got %v", test.options, test.want, err)
    }
    if _, active := engine.EnabledRules()[unicornPreferNumberPropertiesRuleName]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}
