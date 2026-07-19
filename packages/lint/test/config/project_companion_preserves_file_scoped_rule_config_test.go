package linthost

import (
  "path/filepath"
  "testing"
)

// TestProjectCompanionPreservesFileScopedRuleConfig verifies adding editor
// state to a built-in file rule does not make its existing scoped config
// illegal or project-wide.
//
// Project state has no file identity, so the companion may run only from a
// global declaration. The matching file rule must still receive a files entry
// exactly as before, while the companion remains not evaluated.
//
//  1. Parse a files-scoped jsdoc/check-tag-names declaration.
//  2. Resolve both project and matching-file views of that config.
//  3. Assert the file rule is enabled and the companion is undeclared.
func TestProjectCompanionPreservesFileScopedRuleConfig(t *testing.T) {
  const name = "jsdoc/check-tag-names"
  root := t.TempDir()
  store, err := parseExternalConfigStore(map[string]any{
    "files": []any{"src/**"},
    "rules": map[string]any{name: "warn"},
  }, root)
  if err != nil {
    t.Fatalf("parse scoped companion config: %v", err)
  }
  settings, err := store.ResolveProjectRules([]string{name})
  if err != nil {
    t.Fatalf("file-scoped companion declaration should remain valid: %v", err)
  }
  if settings[name].Declared {
    t.Fatalf("file-scoped declaration leaked into project state: %#v", settings[name])
  }
  resolved := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
  if severity := resolved.Rules[name]; severity != SeverityWarn {
    t.Fatalf("matching file lost its rule severity: want %v, got %v", SeverityWarn, severity)
  }
}
