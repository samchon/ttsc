package main

import "testing"

// TestFormatBlockAbsentKeepsFormatRulesOff verifies the opt-in
// contract: with no `format` block and no `format/*` entries in
// `rules`, every format rule stays off.
//
// This is the round-trip safety net for users who don't want
// formatting today. A regression that enabled format defaults
// without an explicit block would silently rewrite source on
// `ttsc format` for every existing project.
//
//  1. Build a plugin entry with `rules: { "no-var": "error" }` only.
//  2. Resolve.
//  3. Assert no `format/*` rule is enabled.
func TestFormatBlockAbsentKeepsFormatRulesOff(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "rules": map[string]any{
        "no-var": "error",
      },
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  for name := range enabled {
    if name == "no-var" {
      continue
    }
    if len(name) >= len("format/") && name[:len("format/")] == "format/" {
      t.Errorf("expected no format rule to be enabled, found %q", name)
    }
  }
}
