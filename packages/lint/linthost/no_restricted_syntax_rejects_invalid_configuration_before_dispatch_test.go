package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedSyntaxRejectsInvalidConfigurationBeforeDispatch verifies
// invalid no-restricted-syntax configuration fails before rule dispatch.
//
// Malformed options must produce a configuration error and leave the rule out of
// the dispatch table.
//
//  1. Build fourteen invalid inputs: malformed JSON, wrong or null fields, unknown,
//     empty and duplicate entries, and malformed attribute, regex and class
//     selectors.
//  2. Bind each through the engine.
//  3. Assert the expected error and that no dispatch entry exists.
//
// @evidence contracts/testing.md#behavioral-verification Fourteen named invalid inputs require their expected configuration errors and an absent rule dispatch entry.
// @evidence contracts/testing.md#independent-expectations Hand-authored malformed/type/field/duplicate/selector/regexp/class errors follow the public schema and grammar; validation errors are not inferred from findings.
// @evidence contracts/testing.md#distinguishing-cases Malformed JSON, wrong/null fields, unknown/empty/duplicate entries and malformed attribute/regex/class selectors reject; configured-entry and command-success cases supply accepted counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxRejectsInvalidConfigurationBeforeDispatch is selected in the shared Go unit population. Its fourteen named subtests call noRestrictedSyntaxValidationEngine, ConfigError and EnabledRules directly, retaining each failure identity. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxRejectsInvalidConfigurationBeforeDispatch(t *testing.T) {
  cases := []struct {
    name    string
    options json.RawMessage
    want    string
  }{
    {name: "malformed JSON", options: json.RawMessage(`{"selector":`), want: "must contain only selector and message"},
    {name: "wrong entry type", options: json.RawMessage(`42`), want: "must be a selector string or {selector,message} object"},
    {name: "missing selector", options: json.RawMessage(`{"message":"missing"}`), want: "is missing selector"},
    {name: "null selector", options: json.RawMessage(`{"selector":null}`), want: "selector must be a string"},
    {name: "null message", options: json.RawMessage(`{"selector":"Identifier","message":null}`), want: "message must be a string"},
    {name: "boolean message", options: json.RawMessage(`{"selector":"Identifier","message":true}`), want: "message must be a string"},
    {name: "unknown key", options: json.RawMessage(`{"selector":"Identifier","extra":true}`), want: "unknown field"},
    {name: "empty selector", options: json.RawMessage(`"  "`), want: "selector must not be empty"},
    {name: "duplicate", options: json.RawMessage(`["Identifier","Identifier"]`), want: "duplicates an earlier option"},
    {name: "unterminated attribute", options: json.RawMessage(`"Identifier[name='x'"`), want: "expected ']'"},
    {name: "invalid regexp", options: json.RawMessage(`"Identifier[name=/(/]"`), want: "invalid regular expression"},
    {name: "empty regexp", options: json.RawMessage(`"Identifier[name=//]"`), want: "regular expression must not be empty"},
    {name: "invalid unquoted path", options: json.RawMessage(`"Identifier[name==value]"`), want: "expected attribute value"},
    {name: "unknown class", options: json.RawMessage(`":mystery"`), want: "unknown AST class"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      engine := noRestrictedSyntaxValidationEngine(tc.options)
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), tc.want) {
        t.Fatalf("invalid no-restricted-syntax config mismatch: want=%q got=%v", tc.want, err)
      }
      if _, active := engine.EnabledRules()["no-restricted-syntax"]; active {
        t.Fatalf("invalid rule entered dispatch: %v", engine.EnabledRules())
      }
    })
  }
}
