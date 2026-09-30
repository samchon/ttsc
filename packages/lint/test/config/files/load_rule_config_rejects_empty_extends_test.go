package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsEmptyExtends verifies discovered config shape validation.
//
// An empty extends string must fail instead of silently behaving like an omitted base.
//
// 1. Write the original malformed lint.config.json fixture beside tsconfig.json.
// 2. Call LoadConfigResolver through automatic discovery and assert the validation diagnostic.
// 3. Replace the malformed field with its valid empty-config counterpart.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver discovers and loads the authored JSON fixture; its non-nil error and diagnostic fragment reject the malformed field before rules can execute. The accepted control prevents blanket config rejection.
// @evidence contracts/testing.md#independent-expectations The config contract requires a non-empty extends path; the exact authored JSON and literal error fragment preserve the migrated config-failure scenario.
// @evidence contracts/testing.md#distinguishing-cases The original empty-string input is rejected through automatic config discovery, while an omitted extends field is accepted as its adjacent control.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigRejectsEmptyExtends owns these config semantics in the same selected Go unit process with fixture files and direct LoadConfigResolver calls; no native producer, consumer install or child host is started. Native config-error propagation remains in the shared boundary batch.
func TestLoadRuleConfigRejectsEmptyExtends(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
  config := filepath.Join(root, "lint.config.json")
  writeFile(t, config, "{\"extends\":\"\"}")
  _, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json")
  if err == nil || !strings.Contains(err.Error(), "extends must not be empty") {
    t.Fatalf("malformed discovered config error = %v, want %q", err, "extends must not be empty")
  }
  writeFile(t, config, "{}")
  if _, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json"); err != nil {
    t.Fatalf("valid adjacent config rejected: %v", err)
  }
}
