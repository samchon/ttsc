package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLoadRuleConfigMissingConfigErrorNamesSearchOrigins verifies that the
// missing-config error reports the directories discovery actually walked.
//
// The error used to print cwd as the search origin even though discovery
// walked upward from the tsconfig's directory — for an out-of-tree wrapper
// tsconfig the message named a directory that DID contain a lint.config.ts,
// sending users hunting for a phantom filesystem problem. The message must
// name the tsconfig directory (primary origin) and the cwd (fallback origin).
//
// 1. Create separate cwd and wrapper-tsconfig temp dirs with no lint config.
// 2. Call LoadRuleConfig with an empty Config map to trigger discovery.
// 3. Assert the error names both search origins.
func TestLoadRuleConfigMissingConfigErrorNamesSearchOrigins(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, wrapper)
  if err == nil {
    t.Fatal("expected missing lint config to fail")
  }
  if !strings.Contains(err.Error(), wrapperDir) {
    t.Fatalf("error must name the tsconfig directory %s it searched from, got %v", wrapperDir, err)
  }
  if !strings.Contains(err.Error(), dir) {
    t.Fatalf("error must name the cwd fallback %s it searched from, got %v", dir, err)
  }
}
