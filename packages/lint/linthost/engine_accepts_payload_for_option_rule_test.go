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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver accepts the authored allowElseIf:false payload for no-else-return and retains the error-severity dispatch entry.
// @evidence contracts/testing.md#independent-expectations The supported no-else-return object option is authored JSON, and nil ConfigError plus the literal enabled rule establish acceptance without deriving a schema from implementation.
// @evidence contracts/testing.md#distinguishing-cases An option-capable rule contrasts optionless no-var payload rejection; actual no-else-return source decisions are owned by that rule family, not this binding test.
// @evidence contracts/testing.md#execution-ownership Direct inline resolver and engine construction run in the shared Go process without a config subprocess; this entry verifies binding acceptance rather than executing the rule option on a source.
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
