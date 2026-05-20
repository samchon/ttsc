package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigRejectsLegacyConfigFileAliases verifies that the old `configFile` and
// `configPath` keys in a PluginEntry.Config are rejected with an actionable error.
//
// These aliases predate the `extends` key and were removed when the config contract was
// stabilized. Silently ignoring them would leave users with no lint rules applied and no
// diagnostic to explain why. The error must point at the supported `extends` field so users
// can migrate without consulting the changelog.
//
// 1. For each legacy key, call LoadRuleConfig with that key set in Config.
// 2. Assert an error is returned for every legacy key.
// 3. Assert each error message mentions "use \"extends\"".
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
