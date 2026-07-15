package linthost

import (
  "encoding/json"
  "testing"
)

// TestEngineAcceptsOptionsForOptionsBearingRule is the negative twin proving the
// optionless gate does not over-reject: a rule that advertises option support
// keeps its payload.
//
// Support is advertised two ways the gate must both honor — the ConsumesOptions
// marker for a lenient decoder (`default-case`) and a ValidateOptions schema
// (`unicorn/string-content`). Each receives a valid payload; neither may raise a
// ConfigError, and both must stay enabled. Were `ruleAcceptsOptions` to miss
// either path, an option-bearing rule would be wrongly reported as optionless.
//
//  1. Configure a marker rule and a validator rule each with a valid payload.
//  2. Assert no ConfigError is raised.
//  3. Assert both rules are active in EnabledRules.
func TestEngineAcceptsOptionsForOptionsBearingRule(t *testing.T) {
  cases := []struct {
    rule    string
    options string
  }{
    {rule: "default-case", options: `{"commentPattern":"^skip"}`},
    {rule: "unicorn/string-content", options: `{"patterns":{"foo":"bar"}}`},
  }
  for _, testCase := range cases {
    t.Run(testCase.rule, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules:   RuleConfig{testCase.rule: SeverityError},
        Options: RuleOptionsMap{testCase.rule: json.RawMessage(testCase.options)},
      })
      if err := engine.ConfigError(); err != nil {
        t.Fatalf("valid options %q on %q raised ConfigError: %v", testCase.options, testCase.rule, err)
      }
      if _, active := engine.EnabledRules()[testCase.rule]; !active {
        t.Fatalf("option-bearing rule %q dropped out of dispatch: %v", testCase.rule, engine.EnabledRules())
      }
    })
  }
}
