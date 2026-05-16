package main

import "testing"

// TestFormatBlockSeverityOffDisablesAllFormatRules verifies that
// `format: { severity: "off" }` zeros every format rule it would
// otherwise enable.
//
// `"off"` is the documented escape hatch for temporarily silencing
// formatting from CI without removing the block. A regression that
// emitted any rule entry under `severity: "off"` would leak findings
// past the engine's pre-filter into `ttsc check`.
//
//  1. Build a plugin entry with `format: { severity: "off" }`.
//  2. Resolve through `LoadConfigResolver`.
//  3. Assert no format/* rule is enabled.
func TestFormatBlockSeverityOffDisablesAllFormatRules(t *testing.T) {
  entry := &PluginEntry{
    Config: map[string]any{
      "format": map[string]any{
        "severity": "off",
      },
    },
  }
  resolver, err := LoadConfigResolver(entry, "/virtual", "")
  if err != nil {
    t.Fatalf("LoadConfigResolver: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  if len(enabled) != 0 {
    t.Fatalf("expected empty rule set, got %v", enabled)
  }
}
