package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidSeverity verifies that `format.severity` uses
// the same severity parser as rule entries.
//
// The field is optional and defaults to off, but once present it is still a
// user-authored policy knob. Typos must fail at the format-block boundary
// instead of being ignored and silently falling back to off.
//
//  1. Build `format: { severity: "maybe" }`.
//  2. Resolve.
//  3. Assert the error points at `format.severity`.
func TestFormatBlockRejectsInvalidSeverity(t *testing.T) {
  _, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "format": map[string]any{"severity": "maybe"},
    },
  }, "/virtual", "")
  if err == nil {
    t.Fatal("expected error for invalid format.severity, got nil")
  }
  if !strings.Contains(err.Error(), "format.severity") {
    t.Errorf("expected error to mention format.severity, got %v", err)
  }
}
