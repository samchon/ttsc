package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedTypesOptionsValidatorAcceptsTheCompleteOfficialRuntimeSchema verifies supported no-restricted-types option shapes remain active.
//
// Rule binding must retain every public restriction value form without disabling a valid rule.
//
// 1. Supply defaults, empty options, an empty types map and the complete restriction-value union.
// 2. Bind each option payload through InlineRuleResolver into the production engine.
// 3. Require no configuration error and an active error-severity rule for every case.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver accepts defaults, empty object, empty types map and all Boolean/null/string/object restriction forms, and keeps the rule active at error severity.
// @evidence contracts/testing.md#independent-expectations The public no-restricted-types option schema admits these authored forms and typed message/fixWith/suggest values; literal active/error expectations do not use the validator to generate a schema.
// @evidence contracts/testing.md#distinguishing-cases Owns nil, empty boundaries and every accepted restriction-value union member, including fix-only, suggestion-only and full structured values; malformed boundaries are owned by the rejection entry.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns four named subcases, passing literal JSON through InlineRuleResolver and NewEngineWithResolver in the shared lint process; rule binding and activation are observed directly without a source walk or native host build.
func TestNoRestrictedTypesOptionsValidatorAcceptsTheCompleteOfficialRuntimeSchema(t *testing.T) {
  tests := []struct {
    name    string
    options json.RawMessage
  }{
    {name: "defaults", options: nil},
    {name: "empty object", options: json.RawMessage(`{}`)},
    {name: "empty types map", options: json.RawMessage(`{"types":{}}`)},
    {
      name: "complete value union",
      options: json.RawMessage(`{"types":{
        "Enabled":true,
        "Disabled":false,
        "Cleared":null,
        "Message":"Use Safe.",
        "EmptyObject":{},
        "FixOnly":{"fixWith":"Safe"},
        "SuggestOnly":{"suggest":["Safer","Safest"]},
        "Structured":{"message":"Use Safe.","fixWith":"Safe","suggest":["Safer","Safest"]}
      }}`),
    },
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      engine := noRestrictedTypesValidationEngine(test.options)
      if err := engine.ConfigError(); err != nil {
        t.Fatalf("valid no-restricted-types options were rejected: %v", err)
      }
      if engine.EnabledRules()[noRestrictedTypesRuleName] != SeverityError {
        t.Fatalf("valid options did not activate the rule: %v", engine.EnabledRules())
      }
    })
  }
}
