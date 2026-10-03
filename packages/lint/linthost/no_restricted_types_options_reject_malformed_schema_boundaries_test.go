package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedTypesOptionsValidatorRejectsEveryMalformedSchemaBoundary verifies malformed no-restricted-types options are rejected before dispatch.
//
// A later syntax walk cannot rescue invalid configuration; every malformed declaration must fail closed during rule binding.
//
// 1. Supply eighteen malformed payloads spanning JSON syntax, containers and nested field types.
// 2. Bind each payload through InlineRuleResolver into the production engine.
// 3. Require the authored field diagnostic, rule identity and absence from enabled rules.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver rejects eighteen authored malformed JSON/container/key/value cases, preserves each expected field diagnostic plus rule identity, and leaves the rule out of dispatch.
// @evidence contracts/testing.md#independent-expectations The declared restriction schema requires an object, a types object, and Boolean/string/null/structured restrictions with typed message/fixWith/suggest fields; literal case-specific error fragments supply independent failure expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns malformed JSON, null/scalar/array root, unknown outer key, bad types container, numeric restriction, unknown nested key, Boolean/null message and fix, and null/scalar/mixed-array and null-element suggestions; the acceptance entry exercises valid neighboring forms.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns eighteen named malformed-payload subcases; InlineRuleResolver and NewEngineWithResolver reach the owning option validator in the shared process, so no native compilation or independently installed consumer is needed to observe rejection.
func TestNoRestrictedTypesOptionsValidatorRejectsEveryMalformedSchemaBoundary(t *testing.T) {
  tests := []struct {
    name    string
    options json.RawMessage
    want    string
  }{
    {name: "malformed JSON", options: json.RawMessage(`{"types":`), want: "decode options.types"},
    {name: "null options", options: json.RawMessage(`null`), want: "options must be an object"},
    {name: "scalar options", options: json.RawMessage(`"Banned"`), want: "options must be an object"},
    {name: "array options", options: json.RawMessage(`[]`), want: "options must be an object"},
    {name: "unknown outer key", options: json.RawMessage(`{"type":{}}`), want: `unknown option "type"`},
    {name: "types is null", options: json.RawMessage(`{"types":null}`), want: "options.types must be an object"},
    {name: "types is array", options: json.RawMessage(`{"types":[]}`), want: "options.types must be an object"},
    {name: "numeric entry", options: json.RawMessage(`{"types":{"Banned":1}}`), want: "restriction must be a boolean, string, object, or null"},
    {name: "object has unknown key", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","replacement":"Safe"}}}`), want: "unknown field"},
    {name: "message is boolean", options: json.RawMessage(`{"types":{"Banned":{"message":true}}}`), want: "message must be a string"},
    {name: "message is null", options: json.RawMessage(`{"types":{"Banned":{"message":null}}}`), want: "message must be a string"},
    {name: "fixWith is boolean", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","fixWith":true}}}`), want: "fixWith must be a string"},
    {name: "fixWith is null", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","fixWith":null}}}`), want: "fixWith must be a string"},
    {name: "suggest is null", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":null}}}`), want: "suggest must be a string array"},
    {name: "suggest is string", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":"Safe"}}}`), want: "suggest must be a string array"},
    {name: "suggest has non-string", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":["Safe",1]}}}`), want: "suggest must be a string array"},
    {name: "suggest has null", options: json.RawMessage(`{"types":{"Banned":{"suggest":[null]}}}`), want: "suggest must be a string array"},
    {name: "suggest has null after string", options: json.RawMessage(`{"types":{"Banned":{"suggest":["Safe",null]}}}`), want: "suggest must be a string array"},
  }

  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      engine := noRestrictedTypesValidationEngine(test.options)
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) ||
        !strings.Contains(err.Error(), `invalid options for rule "typescript/no-restricted-types"`) {
        t.Fatalf("invalid options mismatch: want=%q got=%v", test.want, err)
      }
      if _, active := engine.EnabledRules()[noRestrictedTypesRuleName]; active {
        t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
      }
    })
  }
}
