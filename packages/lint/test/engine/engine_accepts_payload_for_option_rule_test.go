package linthost

import (
  "encoding/json"
  "testing"
)

// TestEngineAcceptsPayloadForOptionRule verifies a rule with the structural
// options capability retains its existing DecodeOptions path.
//
// `no-else-return` has no ValidateOptions method, so it is the important
// negative twin to optionless rejection: acceptance comes from the uniform
// marker rather than the older, incomplete validator interface.
//
//  1. Configure `no-else-return` with its valid object option.
//  2. Construct the engine.
//  3. Assert no configuration error and an enabled dispatch entry.
func TestEngineAcceptsPayloadForOptionRule(t *testing.T) {
  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-else-return": SeverityError},
    Options: RuleOptionsMap{
      "no-else-return": json.RawMessage(`{"allowElseIf":false}`),
    },
  })
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("marked option rule rejected valid payload: %v", err)
  }
  if engine.EnabledRules()["no-else-return"] != SeverityError {
    t.Fatalf("marked option rule was not enabled: %v", engine.EnabledRules())
  }
}
