package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestConfigStoreOptionFoldHonorsBothEntryOrders proves declaration order is
// applied only among entries that match the requested file. Reversing global
// and scoped tuples reverses the selected-file winner without changing the
// unselected file's payload.
func TestConfigStoreOptionFoldHonorsBothEntryOrders(t *testing.T) {
  root := t.TempDir()
  global := ConfigEntry{
    BaseDir: root,
    Rules:   RuleConfig{"no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"VariableDeclaration"`)},
  }
  scoped := ConfigEntry{
    BaseDir: root,
    Files:   []string{"tests/**"},
    Rules:   RuleConfig{"no-restricted-syntax": SeverityWarn},
    Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`)},
  }

  tests := []struct {
    name         string
    entries      []ConfigEntry
    selectedWant string
    severityWant Severity
  }{
    {
      name:         "scoped tuple declared last",
      entries:      []ConfigEntry{global, scoped},
      selectedWant: `"DebuggerStatement"`,
      severityWant: SeverityWarn,
    },
    {
      name:         "global tuple declared last",
      entries:      []ConfigEntry{scoped, global},
      selectedWant: `"VariableDeclaration"`,
      severityWant: SeverityError,
    },
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      store := &ConfigStore{entries: test.entries}
      selected := store.ResolveRules(filepath.Join(root, "tests", "unit.ts"))
      if selected.Rules.Severity("no-restricted-syntax") != test.severityWant ||
        string(selected.RuleOptions("no-restricted-syntax")) != test.selectedWant {
        t.Fatalf("selected fold mismatch: %+v options=%s", selected, selected.RuleOptions("no-restricted-syntax"))
      }
      unselected := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
      if unselected.Rules.Severity("no-restricted-syntax") != SeverityError ||
        string(unselected.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
        t.Fatalf("nonmatching tuple leaked into main file: %+v options=%s", unselected, unselected.RuleOptions("no-restricted-syntax"))
      }
    })
  }
}
