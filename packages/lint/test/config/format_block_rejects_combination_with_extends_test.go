package main

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsCombinationWithExtends verifies the v1 loader
// rejects entries that combine `format` and `extends` on the same
// plugin entry.
//
// The combination is theoretically supportable but adds significant
// merge complexity (extends resolves to an arbitrary external
// `ConfigStore`; layering format defaults over a multi-entry store
// requires extra plumbing). Until that lands, the explicit
// rejection guards users from a half-implemented behavior.
//
//  1. Build a plugin entry with both `format: {}` and
//     `extends: "./other.json"`.
//  2. Call `LoadConfigResolver`.
//  3. Assert an error whose message names the conflict and points
//     the user at putting format inside the extends-target.
func TestFormatBlockRejectsCombinationWithExtends(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format":  map[string]any{},
      "extends": "./other.json",
    },
  }
  _, err := LoadConfigResolver(entry, "/virtual", "")
  if err == nil {
    t.Fatal("expected error, got nil")
  }
  if !strings.Contains(err.Error(), "\"format\" and \"extends\" cannot be combined") {
    t.Fatalf("expected combination-rejection error, got: %v", err)
  }
}
