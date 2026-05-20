package linthost

import (
  "testing"
)

// TestParseRulesNilTreatedAsEmpty verifies that a nil rules map is accepted and returns an
// empty RuleConfig rather than an error.
//
// The host serializes the plugin entry's rules field from JSON; a missing `rules` key
// deserializes to a nil map[string]any. ParseRules must handle nil gracefully so callers do not
// need to guard against the nil case before calling. Returning an error for nil would break
// every plugin entry that omits the rules key.
//
// 1. Call ParseRules(nil).
// 2. Assert no error is returned.
// 3. Assert the returned RuleConfig has zero entries.
func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
  cfg, err := ParseRules(nil)
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if len(cfg) != 0 {
    t.Errorf("want empty config, got %v", cfg)
  }
}
