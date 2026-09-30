package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsArrayRules verifies discovered config shape validation.
//
// A rules array must fail instead of losing intended rule names during severity-map interpretation.
//
// 1. Write the original malformed lint.config.json fixture beside tsconfig.json.
// 2. Call LoadConfigResolver through automatic discovery and assert the validation diagnostic.
// 3. Replace the malformed field with its valid empty-config counterpart.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver discovers and loads the authored JSON fixture; its non-nil error and diagnostic fragment reject the malformed field before rules can execute. The accepted control prevents blanket config rejection.
// @evidence contracts/testing.md#independent-expectations The config contract defines rules as a name-to-severity map; the original ["no-var"] array and literal typed error fragment independently distinguish shape validation.
// @evidence contracts/testing.md#distinguishing-cases The original single-element rules array is rejected through automatic discovery; the adjacent empty severity-map object is accepted.
// @evidence contracts/testing.md#execution-ownership TestLoadRuleConfigRejectsArrayRules owns these config semantics in the same selected Go unit process with fixture files and direct LoadConfigResolver calls; no native producer, consumer install or child host is started. Native config-error propagation remains in the shared boundary batch.
func TestLoadRuleConfigRejectsArrayRules(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
  config := filepath.Join(root, "lint.config.json")
  writeFile(t, config, "{\"rules\":[\"no-var\"]}")
  _, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json")
  if err == nil || !strings.Contains(err.Error(), "must be a rule severity map") {
    t.Fatalf("malformed discovered config error = %v, want %q", err, "must be a rule severity map")
  }
  writeFile(t, config, "{\"rules\":{}}")
  if _, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json"); err != nil {
    t.Fatalf("valid adjacent config rejected: %v", err)
  }
}
