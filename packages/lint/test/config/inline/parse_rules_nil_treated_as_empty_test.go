package main

import (
  "testing"
)

// TestParseRulesNilTreatedAsEmpty verifies parse rules nil treated as empty.
//
// Inline lint config is the native plugin contract carried inside the ttsc plugin entry. These
// tests verify severity parsing before any external ESLint-style config file is considered.
//
// This scenario focuses on parse rules nil treated as empty. It protects the strict
// inline-config shape so unsupported values fail loudly instead of being interpreted as ESLint
// flat-config tuples.
//
// 1. Build the inline rules object used by the host payload.
// 2. Parse it through the native severity normalizer.
// 3. Assert accepted severities or the explicit contract error.
func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
  cfg, err := ParseRules(nil)
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if len(cfg) != 0 {
    t.Errorf("want empty config, got %v", cfg)
  }
}
