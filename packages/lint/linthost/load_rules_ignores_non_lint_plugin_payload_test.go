package linthost

import "testing"

// TestLoadRulesIgnoresNonLintPluginPayload verifies unknown plugin entries are inert.
//
// Disabled plugins are filtered by the host before the sidecar receives
// --plugins-json, so the lint binary must treat payloads without @ttsc/lint as
// an empty rule set. Other plugin descriptors should not trigger discovery.
//
// This scenario exercises ParsePlugins, FindLintEntry, and loadRules through a
// payload containing only unrelated or disabled-looking plugin descriptors.
//
// 1. Build a plugins-json payload without an @ttsc/lint entry.
// 2. Load rules through the command helper.
// 3. Assert the resulting resolver has no enabled rules.
//
// @evidence contracts/testing.md#behavioral-verification Actual loadRules on banner transform and disabled-looking unrelated check descriptors returns a resolver with no enabled rules and no error.
// @evidence contracts/testing.md#independent-expectations Neither authored descriptor has the supported lint identity, so the literal empty enabled configuration follows descriptor-selection semantics rather than checking repository fixture placement.
// @evidence contracts/testing.md#distinguishing-cases Different unrelated stages and an enabled:false-looking config must remain inert by name; populated lint parsing is a separate positive descriptor control, not a claim that disabled filtering ran.
// @evidence contracts/testing.md#execution-ownership Actual owning Go loadRules executes in-process with an isolated temporary cwd; no ttsx script evaluator, installed consumer, native producer or separate host is required for the absent lint entry.
func TestLoadRulesIgnoresNonLintPluginPayload(t *testing.T) {
  rules, err := loadRules(`[
    {"name":"@ttsc/banner","stage":"transform","config":{}},
    {"name":"disabled","stage":"check","config":{"enabled":false}}
  ]`, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatalf("loadRules: %v", err)
  }
  if enabled := rules.EnabledRuleConfig(); len(enabled) != 0 {
    t.Fatalf("non-lint payload should not enable rules, got %+v", enabled)
  }
}
