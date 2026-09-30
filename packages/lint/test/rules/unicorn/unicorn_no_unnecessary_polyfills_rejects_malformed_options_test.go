package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions verifies option
// validation happens at engine construction: every shape upstream's schema
// rejects surfaces as a ConfigError before any file is linted.
//
// Silent acceptance would let a typo disable the rule with no signal — the same
// failure mode the silent stub this rule replaces had.
//
//  1. Build an engine with each malformed payload.
//  2. Assert ConfigError carries the expected message fragment.
// @evidence contracts/testing.md#behavioral-verification Actual engine construction validates six named malformed payloads before linting, requiring a ConfigError with an authored message fragment.
// @evidence contracts/testing.md#independent-expectations The supported object/targets schema rejects array/string outer options, misspelled target and number/boolean/null target values independently of observed implementation output.
// @evidence contracts/testing.md#distinguishing-cases Every malformed payload is a named subtest; AcceptsUpstreamSchemaShapes supplies omitted/object/string-query/query-array/target-map controls.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "array", options: `[]`, want: "must be an object"},
    {name: "string", options: `"node 8"`, want: "must be an object"},
    {name: "unknown key", options: `{"target":"node 8"}`, want: "only `targets`"},
    {name: "targets number", options: `{"targets":1}`, want: "Browserslist query"},
    {name: "targets boolean", options: `{"targets":true}`, want: "Browserslist query"},
    {name: "targets null", options: `{"targets":null}`, want: "Browserslist query"},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules:   RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError},
        Options: RuleOptionsMap{unicornNoUnnecessaryPolyfillsRuleName: json.RawMessage(testCase.options)},
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), testCase.want) {
        t.Fatalf("options %q: want ConfigError containing %q, got %v", testCase.options, testCase.want, err)
      }
    })
  }
}
