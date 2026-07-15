package linthost

import (
  "encoding/json"
  "testing"
)

// TestEngineKeepsOptionlessRuleWithoutAPayload is the negative twin of
// TestEngineRejectsOptionsForOptionlessRule: the optionless gate must fire only
// on an actual payload, never on a bare severity.
//
// A bare severity, an absent options slot, and an explicit JSON `null` all mean
// "use the rule's defaults" and must leave an optionless rule enabled with no
// ConfigError. An over-eager gate that rejected these would break every
// severity-only config for the ~400 rules that take no options.
//
//  1. Configure an optionless rule with no payload, an empty payload, and null.
//  2. Assert no ConfigError is raised.
//  3. Assert the rule is active in EnabledRules.
func TestEngineKeepsOptionlessRuleWithoutAPayload(t *testing.T) {
  const rule = "no-labels"
  payloads := []json.RawMessage{nil, json.RawMessage(``), json.RawMessage(`null`)}
  for _, payload := range payloads {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{rule: SeverityError},
      Options: RuleOptionsMap{rule: payload},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("bare-severity payload %q raised ConfigError: %v", string(payload), err)
    }
    if _, active := engine.EnabledRules()[rule]; !active {
      t.Fatalf("optionless rule dropped out of dispatch for payload %q: %v", string(payload), engine.EnabledRules())
    }
  }
}
