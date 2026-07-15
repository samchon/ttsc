package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestEngineRejectsOptionsForOptionlessRule verifies engine construction turns
// an options payload aimed at a rule with no options schema into a hard
// ConfigError instead of silently dropping it.
//
// The optionless-rule case is the general half of issue #626: `no-labels` and
// `no-cond-assign` are ports that take no options, so ESLint-style config like
// `["error", {allowLoop: true}]` or `["error", "always"]` used to be accepted
// and ignored — inert config with no signal, an option-dependent false positive
// AND false negative. Both the object and the bare-scalar payload shapes must be
// rejected, and the rule must not enter the dispatch table.
//
//  1. Build an engine that gives an optionless rule an options payload.
//  2. Assert ConfigError names the rule and the "does not accept options" cause.
//  3. Assert the rule is absent from EnabledRules.
func TestEngineRejectsOptionsForOptionlessRule(t *testing.T) {
  cases := []struct {
    name    string
    rule    string
    options string
  }{
    {name: "object payload", rule: "no-labels", options: `{"allowLoop":true}`},
    {name: "scalar payload", rule: "no-cond-assign", options: `"always"`},
    {name: "array payload", rule: "no-labels", options: `["always"]`},
    {name: "empty object payload", rule: "no-cond-assign", options: `{}`},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules:   RuleConfig{testCase.rule: SeverityError},
        Options: RuleOptionsMap{testCase.rule: json.RawMessage(testCase.options)},
      })
      err := engine.ConfigError()
      if err == nil ||
        !strings.Contains(err.Error(), testCase.rule) ||
        !strings.Contains(err.Error(), "does not accept options") {
        t.Fatalf("options %q on %q: want ConfigError \"does not accept options\", got %v",
          testCase.options, testCase.rule, err)
      }
      if _, active := engine.EnabledRules()[testCase.rule]; active {
        t.Fatalf("%q entered dispatch despite an invalid options payload: %v",
          testCase.rule, engine.EnabledRules())
      }
    })
  }
}
