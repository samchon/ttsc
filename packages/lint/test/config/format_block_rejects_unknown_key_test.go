package main

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsUnknownKey verifies the loader surfaces
// typos in top-level `format` keys at the block's boundary rather
// than silently ignoring them.
//
// A `printwidth: 80` (lowercase w) typo without the boundary check
// would leave `format/print-width` rendered at the default 80
// without surfacing the user's intent. The reject prevents silent
// no-op configs.
//
//  1. Build `format: { printwidth: 80 }` (unknown key).
//  2. Resolve.
//  3. Assert the error names the unknown key and points at the
//     allowed surface.
func TestFormatBlockRejectsUnknownKey(t *testing.T) {
  _, err := LoadConfigResolver(&PluginEntry{
    Config: map[string]any{
      "format": map[string]any{"printwidth": 80},
    },
  }, "/virtual", "")
  if err == nil {
    t.Fatal("expected error for unknown format key, got nil")
  }
  if !strings.Contains(err.Error(), "printwidth") {
    t.Errorf("expected error to name the bad key, got %v", err)
  }
  if !strings.Contains(err.Error(), "TtscLintFormatConfig") {
    t.Errorf("expected error to point at TtscLintFormatConfig, got %v", err)
  }
}
