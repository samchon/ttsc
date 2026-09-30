package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornConsistentFunctionScopingValidatesThePublicOptionShape rejects malformed options before they enter dispatch.
//
// The public boolean option schema and checker dependency independently establish accepted values and inactive malformed rules.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Real engine construction accepts legal options with the checker requirement and rejects invalid rules before dispatch.
// @evidence contracts/testing.md#independent-expectations The public boolean option schema and checker dependency independently establish accepted values and inactive malformed rules.
// @evidence contracts/testing.md#distinguishing-cases Legal booleans contrast with null, arrays, wrong types and unknown keys; enabled hosts own lint effects.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingValidatesThePublicOptionShape owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingValidatesThePublicOptionShape(t *testing.T) {
  valid := []json.RawMessage{nil, json.RawMessage(`{}`), json.RawMessage(`{"checkArrowFunctions":true}`), json.RawMessage(`{"checkArrowFunctions":false}`)}
  for _, options := range valid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornConsistentFunctionScopingRuleName: SeverityError},
      Options: RuleOptionsMap{unicornConsistentFunctionScopingRuleName: options},
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
    {options: json.RawMessage(`{"checkArrowFunctions":null}`), want: `option "checkArrowFunctions" must be a boolean`},
    {options: json.RawMessage(`{"checkArrowFunctions":"yes"}`), want: `option "checkArrowFunctions" must be a boolean`},
    {options: json.RawMessage(`{"unknown":true}`), want: `unknown option "unknown"`},
  }
  for _, test := range invalid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornConsistentFunctionScopingRuleName: SeverityError},
      Options: RuleOptionsMap{unicornConsistentFunctionScopingRuleName: test.options},
    })
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), test.want) {
      t.Fatalf("invalid options %s mismatch: want %q, got %v", test.options, test.want, err)
    }
    if _, active := engine.EnabledRules()[unicornConsistentFunctionScopingRuleName]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}
