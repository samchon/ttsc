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

func TestParseExternalConfigRulesAcceptsESLintSeverityTuples(t *testing.T) {
  cfg, err := parseExternalConfigRules(map[string]any{
    "no-var":                             []any{"error", map[string]any{"ignore": true}},
    "no-console":                         []any{"warn"},
    "@typescript-eslint/no-explicit-any": []any{float64(2), map[string]any{"fixToUnknown": true}},
    "typescript-eslint/consistent-type-imports": "warn",
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityWarn {
    t.Errorf("no-console: want warning, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("no-explicit-any: want error, got %v", cfg.Severity("no-explicit-any"))
  }
  if cfg.Severity("consistent-type-imports") != SeverityWarn {
    t.Errorf("consistent-type-imports: want warning, got %v", cfg.Severity("consistent-type-imports"))
  }
}

func TestParseExternalConfigRulesAcceptsESLintFlatConfigArray(t *testing.T) {
  cfg, err := parseExternalConfigRules([]any{
    map[string]any{
      "name": "base",
      "rules": map[string]any{
        "no-var":     "error",
        "no-console": "warn",
      },
    },
    map[string]any{
      "files": []any{"src/**/*.ts"},
      "rules": map[string]any{
        "no-console":                         "off",
        "@typescript-eslint/no-explicit-any": "error",
      },
    },
    map[string]any{
      "ignores": []any{"dist/**"},
    },
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityOff {
    t.Errorf("no-console: want off after later flat config override, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("no-explicit-any: want error, got %v", cfg.Severity("no-explicit-any"))
  }
}

func TestParseExternalConfigStoreResolvesFilesAndIgnores(t *testing.T) {
  store, err := parseExternalConfigStore([]any{
    map[string]any{
      "rules": map[string]any{
        "no-var":     "error",
        "no-console": "warn",
      },
    },
    map[string]any{
      "files": []any{"src/**/*.test.ts"},
      "rules": map[string]any{
        "no-console": "off",
      },
    },
    map[string]any{
      "ignores": []any{"src/generated/**"},
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }

  main := store.ResolveRules("/project/src/main.ts")
  if main.Ignored {
    t.Fatal("main.ts should not be ignored")
  }
  if main.Rules.Severity("no-var") != SeverityError || main.Rules.Severity("no-console") != SeverityWarn {
    t.Fatalf("main.ts rules not resolved correctly: %+v", main.Rules)
  }

  testFile := store.ResolveRules("/project/src/example.test.ts")
  if testFile.Ignored {
    t.Fatal("example.test.ts should not be ignored")
  }
  if testFile.Rules.Severity("no-var") != SeverityError || testFile.Rules.Severity("no-console") != SeverityOff {
    t.Fatalf("example.test.ts rules not resolved correctly: %+v", testFile.Rules)
  }

  generated := store.ResolveRules("/project/src/generated/schema.ts")
  if !generated.Ignored {
    t.Fatalf("generated file should be ignored, got %+v", generated)
  }
}

func TestParseExternalConfigStoreRespectsBasePath(t *testing.T) {
  store, err := parseExternalConfigStore([]any{
    map[string]any{
      "basePath": "packages/app",
      "files":    []any{"**/*.ts"},
      "rules": map[string]any{
        "no-var": "error",
      },
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }

  matched := store.ResolveRules("/project/packages/app/src/main.ts")
  if matched.Rules.Severity("no-var") != SeverityError {
    t.Fatalf("basePath file should match no-var, got %+v", matched.Rules)
  }
  outside := store.ResolveRules("/project/packages/other/src/main.ts")
  if outside.Rules.Severity("no-var") != SeverityOff {
    t.Fatalf("outside basePath should not match no-var, got %+v", outside.Rules)
  }
}

func TestParseExternalConfigRulesAppliesExtendsBeforeLocalRules(t *testing.T) {
  cfg, err := parseExternalConfigRules(map[string]any{
    "extends": []any{
      map[string]any{
        "rules": map[string]any{
          "no-var":                             "warn",
          "@typescript-eslint/no-explicit-any": "warn",
          "no-console":                         "error",
        },
      },
      []any{
        map[string]any{
          "rules": map[string]any{
            "no-console": "off",
          },
        },
      },
    },
    "rules": map[string]any{
      "@typescript-eslint/no-explicit-any": "error",
    },
  })
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if cfg.Severity("no-var") != SeverityWarn {
    t.Errorf("no-var: want warning from extended config, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityOff {
    t.Errorf("no-console: want off from later extended config, got %v", cfg.Severity("no-console"))
  }
  if cfg.Severity("no-explicit-any") != SeverityError {
    t.Errorf("no-explicit-any: want local override to error, got %v", cfg.Severity("no-explicit-any"))
  }
}

func TestParseExternalConfigRulesRejectsUnresolvedStringExtends(t *testing.T) {
  _, err := parseExternalConfigRules(map[string]any{
    "extends": []any{"eslint:recommended"},
  })
  if err == nil {
    t.Fatal("expected string extends to be rejected")
  }
  if !strings.Contains(err.Error(), "config.extends[0] must be an object or flat config array") {
    t.Fatalf("error should explain unsupported unresolved extends, got %v", err)
  }
}

func TestParseExternalConfigStoreForFileMarksStringExtendsAsRuntimeOnly(t *testing.T) {
  store, err := parseExternalConfigStoreForFile(map[string]any{
    "extends": []any{"eslint/recommended"},
    "rules": map[string]any{
      "no-var": "error",
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if !store.WantsESLintRuntime() {
    t.Fatal("string extends should request ESLint runtime")
  }
  if !store.RequiresESLintRuntime() {
    t.Fatal("string extends should require ESLint runtime")
  }
  if store.Flatten().Severity("no-var") != SeverityError {
    t.Fatalf("local rules should still be available for fallback diagnostics, got %+v", store.Flatten())
  }
}

func TestParseExternalConfigStoreForFileRequiresRuntimeFields(t *testing.T) {
  store, err := parseExternalConfigStoreForFile(map[string]any{
    "languageOptions": map[string]any{
      "parser": map[string]any{},
    },
    "plugins": map[string]any{
      "@typescript-eslint": map[string]any{},
    },
    "rules": map[string]any{
      "@typescript-eslint/no-explicit-any": "error",
    },
  }, "/project")
  if err != nil {
    t.Fatalf("unexpected error: %v", err)
  }
  if !store.WantsESLintRuntime() {
    t.Fatal("runtime-only fields should request ESLint runtime")
  }
  if !store.RequiresESLintRuntime() {
    t.Fatal("runtime-only fields should require ESLint runtime")
  }
}

func TestParseRulesRejectsESLintTuplesInStandardInlineConfig(t *testing.T) {
  _, err := ParseRules(map[string]any{
    "no-var": []any{"error", map[string]any{"ignore": true}},
  })
  if err == nil {
    t.Fatal("expected standard inline config to reject ESLint tuple values")
  }
  if !strings.Contains(err.Error(), "severity must be one of") {
    t.Fatalf("error should explain standard severity contract, got %v", err)
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

func TestFindESLintConfigFileDiscoversNearestAncestor(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findESLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findESLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(dir, "eslint.config.mjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}

func TestFindESLintConfigFilePrefersNearestDirectory(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(nested, "eslint.config.cjs"), "module.exports = [];")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findESLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findESLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(nested, "eslint.config.cjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}

func TestFindESLintConfigFileRejectsSameDirectoryConflicts(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(dir, "eslint.config.cjs"), "module.exports = [];")

  _, err := findESLintConfigFile(dir, "tsconfig.json")
  if err == nil {
    t.Fatal("expected conflicting eslint config files to fail")
  }
  if !strings.Contains(err.Error(), "multiple eslint config files found") {
    t.Fatalf("error should explain conflict, got %v", err)
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
