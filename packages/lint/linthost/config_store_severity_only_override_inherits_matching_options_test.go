package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestConfigStoreSeverityOnlyOverrideInheritsMatchingOptions verifies normal
// rule-setting merge semantics: a later severity-only declaration preserves a
// tuple from an earlier matching entry, but never one from a nonmatching entry.
//
//
// 1. Declare global options, a test severity-only override and script options.
// 2. Resolve one test and one script source.
// 3. Require inherited matching options for the test and explicit options for the script.
//
// @evidence contracts/testing.md#behavioral-verification ConfigStore.ResolveRules applies test warning severity without losing the matching global VariableDeclaration options and chooses explicit script DebuggerStatement options only for scripts.
// @evidence contracts/testing.md#independent-expectations Severity-only overrides retain preceding matching options while an explicit tuple replaces them; independently authored selectors and literal payloads establish both outcomes.
// @evidence contracts/testing.md#distinguishing-cases Owns bare severity versus explicit options across tests and scripts, rejecting inheritance from a nonmatching later tuple.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Direct ConfigStore.ResolveRules calls select test and script settings from authored entries in-process; returned severity and exact option JSON expose inheritance without a source walk or child host.
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
