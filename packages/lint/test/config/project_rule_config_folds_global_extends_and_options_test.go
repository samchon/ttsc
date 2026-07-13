package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
)

// TestProjectRuleConfigFoldsGlobalExtendsAndOptions verifies dedicated project
// resolution is base-first and independent from source ignores.
//
// The child bare severity must replace the base severity without erasing the
// base options tuple. A later explicit off declaration must then win while the
// last explicit options blob remains available as the project-wide setting.
//
//  1. Load a child config that extends a tuple-configured base and adds ignores.
//  2. Assert the child warning and inherited options resolve globally.
//  3. Append an off declaration and assert off wins without losing options.
func TestProjectRuleConfigFoldsGlobalExtendsAndOptions(t *testing.T) {
  const name = "project-test/config-precedence"
  dir := t.TempDir()
  base := filepath.Join(dir, "base.json")
  if err := os.WriteFile(base, []byte(`{"rules":{"project-test/config-precedence":["error",{"mode":"base"}]}}`), 0o644); err != nil {
    t.Fatal(err)
  }
  store, err := parseExternalConfigStore(map[string]any{
    "extends": "./base.json",
    "ignores": []any{"generated/**"},
    "rules":   map[string]any{name: "warning"},
  }, dir)
  if err != nil {
    t.Fatal(err)
  }

  settings, err := store.ResolveProjectRules([]string{name})
  if err != nil {
    t.Fatal(err)
  }
  setting := settings[name]
  if !setting.Declared || setting.Severity != SeverityWarn {
    t.Fatalf("child bare severity should win globally: %#v", setting)
  }
  var options struct {
    Mode string `json:"mode"`
  }
  if err := json.Unmarshal(setting.Options, &options); err != nil || options.Mode != "base" {
    t.Fatalf("base tuple options should persist after bare severity: mode=%q err=%v", options.Mode, err)
  }
  if !store.ResolveRules(filepath.Join(dir, "generated", "file.ts")).Ignored {
    t.Fatal("top-level ignores should continue to select source files")
  }

  store.entries = append(store.entries, ConfigEntry{Rules: RuleConfig{name: SeverityOff}})
  settings, err = store.ResolveProjectRules([]string{name})
  if err != nil {
    t.Fatal(err)
  }
  setting = settings[name]
  if setting.Severity != SeverityOff || string(setting.Options) != `{"mode":"base"}` {
    t.Fatalf("last off should win without erasing explicit options: %#v", setting)
  }
}
