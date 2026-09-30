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
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore preserves a file-scoped companion rule, ResolveProjectRules does not falsely declare it globally, and ResolveRules keeps its warning severity for a matching source.
// @evidence contracts/testing.md#independent-expectations The authored src/** selector and warning literal independently require a file match but no global declaration.
// @evidence contracts/testing.md#distinguishing-cases The same declaration is positive at the matching file and negative at project scope, distinguishing preservation from accidental global promotion.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored scoped JSDoc object reaches parseExternalConfigStore, ResolveProjectRules and ResolveRules directly in-process; global absence and matching-file severity are observed without project callbacks or a native host.
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
