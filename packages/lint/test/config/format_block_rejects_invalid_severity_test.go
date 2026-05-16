package main

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidSeverity verifies the loader surfaces
// an error at the `format.severity` boundary when the value is not in
// the documented allow-list.
//
// Without the boundary check, a typo like `severity: "fatal"` would
// propagate into every per-rule entry the format block expands and
// surface as `rule "format/semi": unknown severity "fatal"` — blaming
// the rule rather than the misspelled key. The strict parse-time
// check turns the diagnostic into something the user can act on.
//
//  1. Build `format: { severity: "fatal" }`.
//  2. Call `LoadConfigResolver`.
//  3. Assert the error mentions `format.severity`.
//  4. Repeat for an out-of-range numeric severity (`severity: 3`).
func TestFormatBlockRejectsInvalidSeverity(t *testing.T) {
  _, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "format": map[string]any{"severity": "fatal"},
    },
  }, "/virtual", "")
  if err == nil {
    t.Fatal("expected error for severity=\"fatal\", got nil")
  }
  if !strings.Contains(err.Error(), "format.severity") {
    t.Errorf("expected error to mention format.severity, got %v", err)
  }

  _, err = LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "format": map[string]any{"severity": float64(3)},
    },
  }, "/virtual", "")
  if err == nil {
    t.Fatal("expected error for severity=3, got nil")
  }
  if !strings.Contains(err.Error(), "format.severity") {
    t.Errorf("expected numeric severity error to mention format.severity, got %v", err)
  }
}
