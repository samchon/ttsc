package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestConfigStoreSeverityOnlyOverrideInheritsMatchingOptions verifies normal
// rule-setting merge semantics: a later severity-only declaration preserves a
// tuple from an earlier matching entry, but never one from a nonmatching entry.
func TestConfigStoreSeverityOnlyOverrideInheritsMatchingOptions(t *testing.T) {
  root := t.TempDir()
  store := &ConfigStore{entries: []ConfigEntry{
    {
      BaseDir: root,
      Rules:   RuleConfig{"no-restricted-syntax": SeverityError},
      Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"VariableDeclaration"`)},
    },
    {
      BaseDir: root,
      Files:   []string{"tests/**"},
      Rules:   RuleConfig{"no-restricted-syntax": SeverityWarn},
    },
    {
      BaseDir: root,
      Files:   []string{"scripts/**"},
      Rules:   RuleConfig{"no-restricted-syntax": SeverityWarn},
      Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`)},
    },
  }}

  testFile := store.ResolveRules(filepath.Join(root, "tests", "unit.ts"))
  if testFile.Rules.Severity("no-restricted-syntax") != SeverityWarn ||
    string(testFile.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
    t.Fatalf("severity-only override lost its matching inherited options: %+v options=%s", testFile, testFile.RuleOptions("no-restricted-syntax"))
  }

  script := store.ResolveRules(filepath.Join(root, "scripts", "build.ts"))
  if script.Rules.Severity("no-restricted-syntax") != SeverityWarn ||
    string(script.RuleOptions("no-restricted-syntax")) != `"DebuggerStatement"` {
    t.Fatalf("explicit option override was not selected: %+v options=%s", script, script.RuleOptions("no-restricted-syntax"))
  }
}
