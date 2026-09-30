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
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig fails absent automatic discovery and includes both separate wrapper and cwd search-origin paths in its diagnostic.
// @evidence contracts/testing.md#independent-expectations Diagnostic context must identify actual primary and fallback search origins; the two known fixture roots supply independent path oracles rather than reproducing the walk.
// @evidence contracts/testing.md#distinguishing-cases Owns two absent origins and checks both are named; missing-config remediation and positive fallback cases are complementary tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Separate temporary cwd and wrapper roots with no config reach LoadRuleConfig directly in-process; both authored root names are checked in the error without evaluating a script or compiling a consumer.
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
