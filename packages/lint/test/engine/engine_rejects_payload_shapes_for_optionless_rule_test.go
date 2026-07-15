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
