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
// @evidence contracts/testing.md#behavioral-verification newFormatCommandResolver keeps configured format/semi prefer-never options authoritative by leaving fallback defaultOptions nil.
// @evidence contracts/testing.md#independent-expectations The explicitly supplied format rule and prefer-never options require omission of fallback defaults under configuration precedence. This state assertion pins selection, while command format hosts own applied output.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Build a format resolver whose inner config already declares a format rule. The asserted decision is: Assert no default options were loaded. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatBlockWinsOverVSCodeSettings owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
