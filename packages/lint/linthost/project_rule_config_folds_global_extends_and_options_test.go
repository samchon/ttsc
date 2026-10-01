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
//
// @evidence contracts/testing.md#behavioral-verification ResolveProjectRules folds child warning over base error while retaining base mode options, leaves global ignores effective for file resolution, then applies off without erasing those options.
// @evidence contracts/testing.md#independent-expectations Project rules have global base-first severity precedence and retain last explicit options across severity-only overrides; authored warning/off and mode base literals establish independent outcomes.
// @evidence contracts/testing.md#distinguishing-cases Owns inherited tuple, child bare severity, source-ignore separation, and later off declaration; project rules with files selectors are rejected by the companion test.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored JSON base and child object reach parseExternalConfigStore and ResolveProjectRules in-process; later off mutation and source ignore resolution observe folding without a script evaluator or project-rule callback.
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
