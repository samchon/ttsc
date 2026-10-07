package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestEngineRejectsPayloadShapesForOptionlessRule verifies any real options
// slot is rejected when the registered rule has no
// AcceptsTtscLintOptions capability.
//
// The payload transport preserves a single scalar or object and wraps multiple
// positional slots in an array. The contract is shape-independent: an empty
// object or array is still a user-supplied slot and must not be silently
// ignored by an optionless rule.
//
//  1. Configure `no-var` with object, scalar, empty-array, and multi-slot blobs.
//  2. Construct an engine for each payload.
//  3. Assert a configuration error and no dispatch-table entry.
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver rejects all four original nonnull payload shapes for optionless no-var and excludes that rule from dispatch.
// @evidence contracts/testing.md#independent-expectations The authored optionless diagnostic names no-var and the forbidden options capability; empty containers still represent supplied options under the supported contract.
// @evidence contracts/testing.md#distinguishing-cases Empty object, scalar string, empty array and two positional slots distinguish shape-independent presence rejection; absent and null slots are accepted in separate cases.
// @evidence contracts/testing.md#execution-ownership Each authored RawMessage enters the actual engine binding gate directly in the shared Go process; the loop retains individual payload failure context without contributor compilation or installation.
func TestEngineRejectsPayloadShapesForOptionlessRule(t *testing.T) {
  payloads := []json.RawMessage{
    json.RawMessage(`{}`),
    json.RawMessage(`"always"`),
    json.RawMessage(`[]`),
    json.RawMessage(`["always",{"typo":true}]`),
  }
  for _, payload := range payloads {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{"no-var": SeverityError},
      Options: RuleOptionsMap{"no-var": payload},
    })
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), `invalid options for rule "no-var": rule does not accept options`) {
      t.Errorf("payload %s was not rejected as optionless: %v", payload, err)
    }
    if _, enabled := engine.EnabledRules()["no-var"]; enabled {
      t.Errorf("payload %s left optionless no-var enabled", payload)
    }
  }
}
