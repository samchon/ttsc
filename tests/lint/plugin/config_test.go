package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestParseRulesAcceptsStringSeverities(t *testing.T) {
  cfg, err := ParseRules(map[string]any{
    "no-var":          "error",
    "no-explicit-any": "warning",
    "no-debugger":     "off",
    "eqeqeq":          "warn",
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-explicit-any") != SeverityWarn {
    t.Errorf("no-explicit-any: want warning, got %v", cfg.Severity("no-explicit-any"))
  }
  if cfg.Severity("no-debugger") != SeverityOff {
    t.Errorf("no-debugger: want off, got %v", cfg.Severity("no-debugger"))
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
  // Unconfigured rule defaults to off.
  if cfg.Severity("not-listed") != SeverityOff {
    t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
  }
}

func TestParseRulesAcceptsLegacyNumericSeverities(t *testing.T) {
  cfg, err := ParseRules(map[string]any{
    "a": float64(0),
    "b": float64(1),
    "c": float64(2),
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("a") != SeverityOff || cfg.Severity("b") != SeverityWarn || cfg.Severity("c") != SeverityError {
    t.Errorf("numeric severities not parsed correctly: %+v", cfg)
  }
}

func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
  cfg, err := ParseRules(nil)
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if len(cfg) != 0 {
    t.Errorf("want empty config, got %v", cfg)
  }
}

func TestParsePluginsRoundTrip(t *testing.T) {
  const blob = `[
    {"name": "@ttsc/lint", "stage": "check", "config": {"config": {"no-var": "error"}}}
  ]`
  entries, err := ParsePlugins(blob)
  if err != nil {
    t.Fatalf("ParsePlugins: %v", err)
  }
  if len(entries) != 1 {
    t.Fatalf("want 1 entry, got %d", len(entries))
  }
  entry, err := FindLintEntry(entries)
  if err != nil {
    t.Fatalf("FindLintEntry: %v", err)
  }
  if entry == nil {
    t.Fatal("FindLintEntry returned nil")
  }
  if entry.Stage != "check" {
    t.Errorf("entry.Stage: want check, got %q", entry.Stage)
  }
  cfg, err := ParseRules(entry.Config["config"])
  if err != nil {
    t.Fatalf("ParseRules: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var severity: want error, got %v", cfg.Severity("no-var"))
  }
}

func TestFindLintEntryRejectsNonFirstLintPlugin(t *testing.T) {
  const blob = `[
    {"name": "source-transform", "stage": "transform", "config": {}},
    {"name": "@ttsc/lint", "stage": "check", "config": {"config": {"no-var": "error"}}}
  ]`
  entries, err := ParsePlugins(blob)
  if err != nil {
    t.Fatalf("ParsePlugins: %v", err)
  }
  entry, err := FindLintEntry(entries)
  if err == nil {
    t.Fatal("expected non-first @ttsc/lint entry to fail")
  }
  if entry != nil {
    t.Fatalf("entry should be nil on placement error, got %+v", entry)
  }
  if !strings.Contains(err.Error(), "first active compilerOptions.plugins entry") {
    t.Fatalf("error should explain plugin placement, got %v", err)
  }
}

func TestParsePluginsRejectsBadJSON(t *testing.T) {
  if _, err := ParsePlugins("not-json"); err == nil {
    t.Error("expected error for malformed JSON")
  } else if !strings.Contains(err.Error(), "invalid --plugins-json") {
    t.Errorf("error should mention plugins-json: %v", err)
  }
}

func TestLoadRuleConfigLoadsJSONConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.json"), `{
    "no-var": "error",
    "eqeqeq": "warning"
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": "./ttsc-lint.config.json",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("eqeqeq") != SeverityWarn {
    t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
  }
}

func TestLoadRuleConfigLoadsJavaScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.cjs"), `module.exports = {
    "no-console": "warn",
    "no-debugger": "error",
  };`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": "./ttsc-lint.config.cjs",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("no-console: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-debugger") != SeverityError {
    t.Errorf("no-debugger: want error, got %v", cfg.Severity("no-debugger"))
  }
}

func TestLoadRuleConfigLoadsTypeScriptConfigFile(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "ttsc-lint.config.ts"), `const config: Record<string, string> = {
    "no-explicit-any": "error",
  };
  export default config;`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": "./ttsc-lint.config.ts",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("no-explicit-any: want error, got %v", cfg.Severity("no-explicit-any"))
  }
}

func TestLoadRuleConfigAcceptsInlineConfigObject(t *testing.T) {
  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "config": map[string]any{
        "no-var": "error",
      },
    },
  }, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
}

func TestLoadRuleConfigRejectsLegacyConfigFileAliases(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  for _, key := range []string{"configFile", "configPath"} {
    _, err := LoadRuleConfig(&PluginEntry{
      Config: map[string]any{
        key: "./ttsc-lint.config.json",
      },
    }, dir, "tsconfig.json")
    if err == nil {
      t.Fatalf("expected %s to be rejected", key)
    }
    if !strings.Contains(err.Error(), "use \"config\"") {
      t.Fatalf("error should point to config-only contract, got %v", err)
    }
  }
}

func TestLoadRuleConfigRejectsLegacyTopLevelRules(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")

  _, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "rules": map[string]any{
        "no-var": "off",
      },
    },
  }, dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected top-level rules to be rejected")
  }
  if !strings.Contains(err.Error(), "use \"config\"") {
    t.Fatalf("error should point to config-only contract, got %v", err)
  }
}

func writeFile(t *testing.T, location, text string) {
  t.Helper()
  if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
    t.Fatalf("MkdirAll: %v", err)
  }
  if err := os.WriteFile(location, []byte(text), 0o644); err != nil {
    t.Fatalf("WriteFile: %v", err)
  }
}
