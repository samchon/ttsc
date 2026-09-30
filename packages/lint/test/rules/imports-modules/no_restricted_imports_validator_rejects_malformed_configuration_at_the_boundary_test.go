package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestNoRestrictedImportsValidatorRejectsMalformedConfigurationAtTheBoundary verifies ConfigError rejects malformed restrictions with their specific reason and excludes the invalid rule from dispatch.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification ConfigError rejects malformed restrictions with their specific reason and excludes the invalid rule from dispatch.
// @evidence contracts/testing.md#independent-expectations The authored schema violation/error-fragment pairs are independent of decoding output and require nonactivation as well as an error.
// @evidence contracts/testing.md#distinguishing-cases Null, truncated JSON, unknown fields, wrong types, missing/empty values, duplicates, conflicting selectors, invalid regex and mutually exclusive name policies cover failure branches.
// @evidence contracts/testing.md#execution-ownership Each authored malformed option/error pair is passed to noRestrictedImportsValidationEngine and its ConfigError/EnabledRules operations. This Test owns every rejection reason and dispatch nonactivation result in the same Go process.
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
