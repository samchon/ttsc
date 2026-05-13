package main

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsLegacyConfigFileAliases verifies legacy config alias rejection.
//
// LoadRuleConfig bridges plugin JSON, discovered config files, and explicit config paths. These
// tests materialize temporary config files so path resolution and legacy-key rejection are
// checked with real filesystem behavior.
//
// This scenario focuses on load rule config rejects legacy config file aliases. It ensures the
// lint package accepts only the supported config contract while still loading JSON, JavaScript,
// and TypeScript config files through the documented path.
//
// 1. Create the temporary tsconfig and lint config files required by the branch.
// 2. Load the rule config through the package helper used by command execution.
// 3. Assert resolved severities or the precise rejection message.
func TestLoadRuleConfigRejectsLegacyConfigFileAliases(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  for _, key := range []string{"configFile", "configPath"} {
    _, err := LoadRuleConfig(&PluginEntry{
      Config: map[string]any{
        key: "./ttsc-lint.config.json",
      },
    }, dir, "tsconfig.json")
    if err == nil {
      t.Fatalf("expected %s to be rejected", key)
    }
    if !strings.Contains(err.Error(), "use \"extends\"") {
      t.Fatalf("error should suggest the supported \"extends\" field, got %v", err)
    }
  }
}
