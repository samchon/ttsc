package linthost

import (
  "encoding/json"
  "testing"
)

// TestParseRulesPreservesPositionalOptions verifies generic ESLint option transport.
//
// Some canonical rules use a positional string followed by an option object.
// Keeping one slot in its native JSON shape preserves existing object decoders,
// while wrapping several slots in an array lets the owning rule decode its own
// schema without a rule-name special case in the config parser.
//
// 1. Parse entries containing one object, one string, and two option slots.
// 2. Decode each stored payload according to its expected generic shape.
// 3. Assert severity and every positional value survive unchanged.
func TestParseRulesPreservesPositionalOptions(t *testing.T) {
  config, options, err := ParseRulesWithOptions(map[string]any{
    "no-duplicate-imports": []any{
      "warning",
      map[string]any{"includeExports": true},
    },
    "single-position": []any{"error", "both"},
    "multi-position": []any{
      "error",
      "functions",
      map[string]any{"blockScopedFunctions": "disallow"},
    },
  })
  if err != nil {
    t.Fatalf("ParseRulesWithOptions: %v", err)
  }
  if config["no-duplicate-imports"] != SeverityWarn ||
    config["single-position"] != SeverityError ||
    config["multi-position"] != SeverityError {
    t.Fatalf("unexpected severities: %+v", config)
  }

  var object struct {
    IncludeExports bool `json:"includeExports"`
  }
  if err := json.Unmarshal(options["no-duplicate-imports"], &object); err != nil || !object.IncludeExports {
    t.Fatalf("single object slot did not preserve its shape: raw=%s err=%v", options["no-duplicate-imports"], err)
  }
  var single string
  if err := json.Unmarshal(options["single-position"], &single); err != nil || single != "both" {
    t.Fatalf("single positional slot: want both, got %q (err=%v)", single, err)
  }
  var multiple []json.RawMessage
  if err := json.Unmarshal(options["multi-position"], &multiple); err != nil {
    t.Fatalf("multiple positional slots: %v", err)
  }
  if len(multiple) != 2 {
    t.Fatalf("multiple positional slots: want 2, got %d", len(multiple))
  }
  var mode string
  var block struct {
    BlockScopedFunctions string `json:"blockScopedFunctions"`
  }
  if err := json.Unmarshal(multiple[0], &mode); err != nil {
    t.Fatalf("decode mode: %v", err)
  }
  if err := json.Unmarshal(multiple[1], &block); err != nil {
    t.Fatalf("decode block options: %v", err)
  }
  if mode != "functions" || block.BlockScopedFunctions != "disallow" {
    t.Fatalf("positional values changed: mode=%q options=%+v", mode, block)
  }
}
