package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Twelve named inputs require the expected error, disabled dispatch and no checker request for invalid configuration.
// @evidence contracts/testing.md#independent-expectations Literal error fragments follow the public schema: object options, boolean props, unique string arrays, valid regexes and compatible ignore/props settings.
// @evidence contracts/testing.md#distinguishing-cases Malformed/null/array/unknown/type/duplicate/regex/disabled-props boundaries reject; the valid schema test supplies accepted counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoParamReassignOptionsValidatorRejectsEveryInvalidSchemaBoundary is selected in the shared Go unit population. Each named subtest calls the owning Engine configuration validator and checks its actual dispatch/checker state, preserving all input and failure identities. No consumer install, native artifact build or real host runs.
func TestNoParamReassignOptionsValidatorRejectsEveryInvalidSchemaBoundary(t *testing.T) {
  cases := []struct {
    name    string
    options json.RawMessage
    want    string
  }{
    {
      name:    "malformed JSON",
      options: json.RawMessage(`{"props":`),
      want:    "options must be valid JSON",
    },
    {
      name:    "null",
      options: json.RawMessage(`null`),
      want:    "options must be an object",
    },
    {
      name:    "array",
      options: json.RawMessage(`[]`),
      want:    "options must be an object",
    },
    {
      name:    "unknown keys are sorted",
      options: json.RawMessage(`{"z":true,"a":true}`),
      want:    `unknown option "a"`,
    },
    {
      name:    "props type",
      options: json.RawMessage(`{"props":null}`),
      want:    `option "props" must be a boolean`,
    },
    {
      name:    "exact ignores require an enabled props branch",
      options: json.RawMessage(`{"props":false,"ignorePropertyModificationsFor":["value"]}`),
      want:    `ignore options cannot be combined with "props" set to false`,
    },
    {
      name:    "empty regex ignores still violate the disabled props branch",
      options: json.RawMessage(`{"props":false,"ignorePropertyModificationsForRegex":[]}`),
      want:    `ignore options cannot be combined with "props" set to false`,
    },
    {
      name:    "exact ignore array type",
      options: json.RawMessage(`{"ignorePropertyModificationsFor":"value"}`),
      want:    `option "ignorePropertyModificationsFor" must be an array of strings`,
    },
    {
      name:    "exact ignore element type",
      options: json.RawMessage(`{"ignorePropertyModificationsFor":["value",1]}`),
      want:    `option "ignorePropertyModificationsFor"[1] must be a string`,
    },
    {
      name:    "duplicate exact ignore",
      options: json.RawMessage(`{"ignorePropertyModificationsFor":["value","value"]}`),
      want:    `option "ignorePropertyModificationsFor" contains duplicate value "value"`,
    },
    {
      name:    "duplicate regex ignore",
      options: json.RawMessage(`{"ignorePropertyModificationsForRegex":["^value$","^value$"]}`),
      want:    `option "ignorePropertyModificationsForRegex" contains duplicate value "^value$"`,
    },
    {
      name:    "invalid regex",
      options: json.RawMessage(`{"ignorePropertyModificationsForRegex":["["]}`),
      want:    `option "ignorePropertyModificationsForRegex"[0] must be a valid regular expression`,
    },
  }

  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      engine := noParamReassignValidationEngine(tc.options)
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), tc.want) {
        t.Fatalf("invalid no-param-reassign options mismatch: want=%q got=%v", tc.want, err)
      }
      if _, active := engine.EnabledRules()["no-param-reassign"]; active {
        t.Fatalf("invalid no-param-reassign options entered the dispatch table: %v", engine.EnabledRules())
      }
      if engine.NeedsTypeChecker() {
        t.Fatal("an invalid no-param-reassign configuration requested a checker")
      }
    })
  }
}
