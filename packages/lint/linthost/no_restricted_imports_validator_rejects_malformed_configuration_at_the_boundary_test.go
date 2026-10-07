package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsValidatorRejectsMalformedConfigurationAtTheBoundary
// verifies engine construction rejects 22 malformed no-restricted-imports
// option values with a specific reason and keeps the rule out of dispatch.
//
// Each case pairs an option value (null, truncated JSON, unknown fields, wrong
// types, missing or empty required values, duplicate entries, conflicting
// selectors, an invalid regex and mutually exclusive name policies) with a
// fragment that the configuration error must contain.
//
// 1. Build an engine through noRestrictedImportsValidationEngine for each case.
// 2. Require a ConfigError containing the case fragment.
// 3. Require no-restricted-imports to be absent from EnabledRules.
//
// @evidence contracts/testing.md#behavioral-verification For each of the 22 malformed option values NewEngineWithResolver reports a ConfigError containing the authored reason fragment, and no-restricted-imports is not in the enabled rule table.
// @evidence contracts/testing.md#independent-expectations Each option value and its error fragment are authored literals taken from the option schema, independent of the decoder, and the Test also requires the rule to be inactive rather than accepting any error.
// @evidence contracts/testing.md#distinguishing-cases The table covers null, truncated JSON, an unknown field, a non-array paths, a wrong-typed name, a missing name, an empty message, a null allowTypeImports, conflicting importNames and allowImportNames, duplicate paths, mixed string and object patterns, a pattern without group or regex, both group and regex, empty and duplicate groups, an invalid regex, an empty importNames, conflicting allow options, unknown pattern keys, a null caseSensitive, an empty pattern message and duplicate pattern objects. Accepted shapes belong to the sibling validator Test.
// @evidence contracts/testing.md#execution-ownership noRestrictedImportsValidationEngine calls NewEngineWithResolver with an InlineRuleResolver in the Go test process; the Test body asserts ConfigError text and EnabledRules for each case in a loop. No source file is parsed.
func TestNoRestrictedImportsValidatorRejectsMalformedConfigurationAtTheBoundary(t *testing.T) {
  cases := []struct {
    options json.RawMessage
    want    string
  }{
    {options: json.RawMessage(`null`), want: "options must be path entries"},
    {options: json.RawMessage(`{"paths":`), want: "options must be an object"},
    {options: json.RawMessage(`{"paths":[],"unexpected":true}`), want: `unknown option "unexpected"`},
    {options: json.RawMessage(`{"paths":"fs"}`), want: `option "paths" must be an array`},
    {options: json.RawMessage(`{"name":1}`), want: `option "name" must be a string`},
    {options: json.RawMessage(`{"message":"missing name"}`), want: `requires "name"`},
    {options: json.RawMessage(`{"name":"pkg","message":""}`), want: `option "message" must not be empty`},
    {options: json.RawMessage(`{"name":"pkg","allowTypeImports":null}`), want: `option "allowTypeImports" must be a boolean`},
    {options: json.RawMessage(`{"name":"pkg","importNames":[],"allowImportNames":[]}`), want: "cannot be combined"},
    {options: json.RawMessage(`["fs","fs"]`), want: `option "paths" contains a duplicate entry`},
    {options: json.RawMessage(`{"patterns":["pkg/*",{"group":["other/*"]}]}`), want: "only strings or only objects"},
    {options: json.RawMessage(`{"patterns":[{}]}`), want: "exactly one"},
    {options: json.RawMessage(`{"patterns":[{"group":["pkg/*"],"regex":"pkg"}]}`), want: "exactly one"},
    {options: json.RawMessage(`{"patterns":[{"group":[]}]}`), want: "at least one string"},
    {options: json.RawMessage(`{"patterns":[{"group":["pkg/*","pkg/*"]}]}`), want: "duplicate value"},
    {options: json.RawMessage(`{"patterns":[{"regex":"["}]}`), want: "valid regular expression"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","importNames":[]}]}`), want: "at least one string"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","allowImportNames":["safe"],"allowImportNamePattern":"^safe"}]}`), want: "cannot be combined"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","unknown":true}]}`), want: `unknown option "unknown"`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","caseSensitive":null}]}`), want: `option "caseSensitive" must be a boolean`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","message":""}]}`), want: `option "message" must not be empty`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","message":"x"},{"message":"x","regex":"pkg"}]}`), want: `option "patterns" contains a duplicate entry`},
  }
  for _, tc := range cases {
    engine := noRestrictedImportsValidationEngine(tc.options)
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), tc.want) {
      t.Fatalf("invalid options %s mismatch: want=%q got=%v", tc.options, tc.want, err)
    }
    if _, active := engine.EnabledRules()["no-restricted-imports"]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}
