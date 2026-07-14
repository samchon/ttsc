package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestConfigStoreResolvesOptionsWithEntryScope pins the severity/options fold
// to the same matching ConfigEntry sequence. A tuple from a sibling files
// selector must not become the option payload for an unrelated file.
func TestConfigStoreResolvesOptionsWithEntryScope(t *testing.T) {
  root := t.TempDir()
  store := &ConfigStore{entries: []ConfigEntry{
    {
      BaseDir: root,
      Rules: RuleConfig{
        "no-restricted-syntax": SeverityError,
        "custom/rule":         SeverityWarn,
      },
      Options: RuleOptionsMap{
        "no-restricted-syntax": json.RawMessage(`"VariableDeclaration"`),
        "custom/rule":         json.RawMessage(`{"mode":"base"}`),
      },
    },
    {
      BaseDir: root,
      Files:   []string{"tests/**"},
      Rules:   RuleConfig{"no-restricted-syntax": SeverityWarn},
      Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`)},
    },
    {
      BaseDir: root,
      Files:   []string{"generated/**"},
      Rules: RuleConfig{
        "no-restricted-syntax": SeverityError,
        "custom/rule":         SeverityError,
      },
      Options: RuleOptionsMap{
        "no-restricted-syntax": json.RawMessage(`"WithStatement"`),
        "custom/rule":         json.RawMessage(`{"mode":"generated"}`),
      },
    },
    {
      BaseDir:    root,
      Ignores:    []string{"vendor/**"},
      IgnoreOnly: true,
    },
  }}

  main := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
  if main.Ignored || main.Rules.Severity("no-restricted-syntax") != SeverityError ||
    string(main.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
    t.Fatalf("main resolution crossed an entry boundary: %+v options=%s", main, main.RuleOptions("no-restricted-syntax"))
  }
  if main.Rules.Severity("custom/rule") != SeverityWarn ||
    string(main.RuleOptions("custom/rule")) != `{"mode":"base"}` {
    t.Fatalf("unrelated rule state crossed a nonmatching entry: %+v options=%s", main, main.RuleOptions("custom/rule"))
  }

  testFile := store.ResolveRules(filepath.Join(root, "tests", "unit.ts"))
  if testFile.Ignored || testFile.Rules.Severity("no-restricted-syntax") != SeverityWarn ||
    string(testFile.RuleOptions("no-restricted-syntax")) != `"DebuggerStatement"` {
    t.Fatalf("test resolution did not select its tuple: %+v options=%s", testFile, testFile.RuleOptions("no-restricted-syntax"))
  }

  ignored := store.ResolveRules(filepath.Join(root, "vendor", "library.ts"))
  if !ignored.Ignored || len(ignored.Options) != 0 {
    t.Fatalf("globally ignored file retained rule state: %+v", ignored)
  }

  main.Options["no-restricted-syntax"][0] = 'x'
  again := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
  if string(again.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
    t.Fatalf("resolved option payload aliases config state: %s", again.RuleOptions("no-restricted-syntax"))
  }
}
