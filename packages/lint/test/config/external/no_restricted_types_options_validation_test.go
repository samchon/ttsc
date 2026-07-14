package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

func noRestrictedTypesValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{noRestrictedTypesRuleName: SeverityError},
    Options: RuleOptionsMap{
      noRestrictedTypesRuleName: options,
    },
  })
}

func TestNoRestrictedTypesOptionsValidatorAcceptsTheCompletePublicSchema(t *testing.T) {
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
    {name: "object misses message", options: json.RawMessage(`{"types":{"Banned":{"fixWith":"Safe"}}}`), want: "requires a string message"},
    {name: "object has unknown key", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","replacement":"Safe"}}}`), want: "unknown field"},
    {name: "message is boolean", options: json.RawMessage(`{"types":{"Banned":{"message":true}}}`), want: "message must be a string"},
    {name: "message is null", options: json.RawMessage(`{"types":{"Banned":{"message":null}}}`), want: "message must be a string"},
    {name: "fixWith is boolean", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","fixWith":true}}}`), want: "fixWith must be a string"},
    {name: "fixWith is null", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","fixWith":null}}}`), want: "fixWith must be a string"},
    {name: "suggest is null", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":null}}}`), want: "suggest must be a string array"},
    {name: "suggest is string", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":"Safe"}}}`), want: "suggest must be a string array"},
    {name: "suggest has non-string", options: json.RawMessage(`{"types":{"Banned":{"message":"Use Safe.","suggest":["Safe",1]}}}`), want: "suggest must be a string array"},
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

func TestNoRestrictedTypesExternalConfigIsValidatedWhenTheEngineBindsIt(t *testing.T) {
  store, err := parseExternalConfigStore(map[string]any{
    "rules": map[string]any{
      noRestrictedTypesRuleName: []any{
        "error",
        map[string]any{"types": map[string]any{"Banned": map[string]any{"fixWith": "Safe"}}},
      },
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  engine := NewEngineWithResolver(store)
  if err := engine.ConfigError(); err == nil || !strings.Contains(err.Error(), "requires a string message") {
    t.Fatalf("engine ConfigError = %v", err)
  }
  if _, active := engine.EnabledRules()[noRestrictedTypesRuleName]; active {
    t.Fatalf("invalid external options entered the dispatch table: %v", engine.EnabledRules())
  }
}
