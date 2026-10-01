package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigConfigFileOverridesDiscovery verifies that a `configFile`
// key on the tsconfig plugin entry loads exactly that file and bypasses the
// upward auto-discovery walk.
//
// `configFile` is the only lint-specific key the tsconfig plugin entry accepts.
// When set, it must win over a discoverable `lint.config.*` sitting beside the
// tsconfig — otherwise a project could not point at a non-default config name
// or location. A regression that still ran discovery would silently apply the
// wrong file's rules.
//
//  1. Write a discoverable lint.config.json (noConsole) and a separate
//     custom.config.json (noVar) in the same temp dir.
//  2. Call LoadRuleConfig with `configFile: "./custom.config.json"`.
//  3. Assert the custom file's rule wins and the discoverable file is ignored.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig resolves no-var from custom.config.json and leaves no-console off despite a discoverable competing lint.config.json.
// @evidence contracts/testing.md#independent-expectations An explicit configFile overrides discovery; different authored rule maps establish the independent selected and excluded severities.
// @evidence contracts/testing.md#distinguishing-cases Owns explicit-versus-discoverable competition, asserting both inclusion and exclusion; no-configFile discovery is checked separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Two conflicting temporary JSON rule maps reach LoadRuleConfig with an explicit custom path in-process; selected and excluded severities observe precedence without a script evaluator or consumer installation.
func TestLoadRuleConfigConfigFileOverridesDiscovery(t *testing.T) {
  dir := t.TempDir()
  writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-console": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "custom.config.json"), `{
    "rules": { "no-var": "error" }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{
      "configFile": "./custom.config.json",
    },
  }, dir, "tsconfig.json")
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Errorf("noVar: want error from configFile target, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") != SeverityOff {
    t.Errorf("noConsole: discoverable file must be ignored when configFile is set, got %v", cfg.Severity("no-console"))
  }
}
