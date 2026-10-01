package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestEngineRejectsOptionlessPayloadWhileRuleIsOff verifies configuration
// validation covers declared payloads independently of dispatch severity.
//
// An off rule never enters ActiveRuleNames, but its tuple still belongs to the
// user's configuration and may contain a typo that becomes active through a
// later override. Validation walks registered rules, not only enabled rules,
// so the inert severity cannot hide an invalid options slot.
//
//  1. Configure optionless `no-var` as off with an object payload.
//  2. Construct the engine.
//  3. Assert the payload is rejected and the rule remains disabled.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver rejects an object options payload for no-var even at off severity, and leaves it out of dispatch.
// @evidence contracts/testing.md#independent-expectations The literal no-var optionless diagnostic independently establishes validation of declared configuration before dispatch eligibility.
// @evidence contracts/testing.md#distinguishing-cases Off severity plus a present typo object distinguishes validation from enabled-rule filtering; the off-without-payload test is the valid neighboring case.
// @evidence contracts/testing.md#execution-ownership Direct inline resolver and engine accessors run in one Go process; this individual entry owns configuration failure semantics, not native descriptor transport.
func TestEngineRejectsOptionlessPayloadWhileRuleIsOff(t *testing.T) {
  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules:   RuleConfig{"no-var": SeverityOff},
    Options: RuleOptionsMap{"no-var": json.RawMessage(`{"typo":true}`)},
  })
  err := engine.ConfigError()
  if err == nil || !strings.Contains(err.Error(), `invalid options for rule "no-var": rule does not accept options`) {
    t.Fatalf("off optionless payload was not rejected: %v", err)
  }
  if _, enabled := engine.EnabledRules()["no-var"]; enabled {
    t.Fatalf("off no-var unexpectedly entered dispatch: %v", engine.EnabledRules())
  }
}
