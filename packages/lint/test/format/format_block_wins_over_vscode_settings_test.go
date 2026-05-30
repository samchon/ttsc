package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockWinsOverVSCodeSettings verifies a configured `format` block is
// authoritative: the .vscode/settings.json defaults path is skipped entirely.
//
// requirement #3's precedence rule: when lint.config.* declares format rules,
// the block wins and editor settings are ignored. newFormatCommandResolver must
// leave defaultOptions nil in that case, so the fallback (and its settings.json
// read) never runs.
//
// 1. Build a format resolver whose inner config already declares a format rule.
// 2. Inspect the resolver.
// 3. Assert no default options were loaded.
func TestFormatBlockWinsOverVSCodeSettings(t *testing.T) {
  inner := InlineRuleResolver{
    Rules:   RuleConfig{"format/semi": SeverityWarn},
    Options: RuleOptionsMap{"format/semi": json.RawMessage(`{"prefer":"never"}`)},
  }
  resolver, err := newFormatCommandResolver(inner, t.TempDir(), "")
  if err != nil {
    t.Fatalf("newFormatCommandResolver: %v", err)
  }
  if resolver.defaultOptions != nil {
    t.Fatalf("expected no default options when a format block is configured")
  }
}
