package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestConfigStoreOptionFoldHonorsBothEntryOrders verifies declaration order is
// applied only among entries that match the requested file. Reversing global
// and scoped tuples reverses the selected-file winner without changing the
// unselected file's payload.
//
// 1. Declare global and file-scoped tuples in both orders.
// 2. Resolve a selected test file and an unselected main file.
// 3. Require each order-dependent winner and the unchanged global main settings.
//
// @evidence contracts/testing.md#behavioral-verification ConfigStore.ResolveRules reverses the selected tests-file severity and options winner when global/scoped declaration order is reversed, while src/main.ts keeps global settings.
// @evidence contracts/testing.md#independent-expectations Only matching entries participate and the last declaration wins; literal VariableDeclaration/error and DebuggerStatement/warn tuples independently establish each order-dependent result.
// @evidence contracts/testing.md#distinguishing-cases Owns both entry orders with a selected and unselected file in each, preventing unconditional later-option leakage.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The two named order cases call ConfigStore.ResolveRules on authored global/scoped entries and selected/unselected paths in-process; returned severity and JSON option bytes establish folding without parsing a consumer project or building a host.
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
