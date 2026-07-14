package linthost

import (
  "encoding/json"
  "testing"
)

// TestParseExternalRuleEntryPreservesThreeSlotTuple verifies file-config transport.
//
// Canonical ESLint rules may carry a positional mode followed by an options
// object. The external config path must preserve that tail as an ordered JSON
// array instead of rejecting it or flattening it into a rule-specific shape.
//
// 1. Parse a severity, declaration mode, and block-function option tuple.
// 2. Decode the returned generic options payload.
// 3. Assert severity, order, and both option values remain exact.
func TestParseExternalRuleEntryPreservesThreeSlotTuple(t *testing.T) {
  severity, raw, err := parseExternalRuleEntry([]any{
    "error",
    "both",
    map[string]any{"blockScopedFunctions": "disallow"},
  })
  if err != nil {
    t.Fatalf("parseExternalRuleEntry: %v", err)
  }
  if severity != SeverityError {
    t.Fatalf("severity: want error, got %v", severity)
  }
  var slots []json.RawMessage
  if err := json.Unmarshal(raw, &slots); err != nil {
    t.Fatalf("decode positional payload: %v", err)
  }
  if len(slots) != 2 {
    t.Fatalf("positional payload: want 2 slots, got %d", len(slots))
  }
  var mode string
  var options struct {
    BlockScopedFunctions string `json:"blockScopedFunctions"`
  }
  if err := json.Unmarshal(slots[0], &mode); err != nil {
    t.Fatalf("decode declaration mode: %v", err)
  }
  if err := json.Unmarshal(slots[1], &options); err != nil {
    t.Fatalf("decode block options: %v", err)
  }
  if mode != "both" || options.BlockScopedFunctions != "disallow" {
    t.Fatalf("positional payload changed: mode=%q options=%+v", mode, options)
  }
}
