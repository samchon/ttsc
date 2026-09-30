package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigResolvesConfigFileRelativeToPluginConfigDirEnv verifies
// that a relative "configFile" plugin-entry path resolves against
// TTSC_PLUGIN_CONFIG_DIR when the channel is set.
//
// Locks resolveConfigFilePath through the explicit anchor: when a build
// integration compiles through a generated wrapper tsconfig in a temp
// directory, a relative configFile would otherwise dangle against the temp
// dir and fail with a not-found error.
//
//  1. Seed a project dir with custom.lint.json and a wrapper dir with only a
//     tsconfig.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and call LoadRuleConfig with
//     configFile "custom.lint.json" and the wrapper tsconfig.
//  3. Assert the project-relative file is loaded.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig loads no-var/error from the project custom.lint.json when a relative configFile is paired with TTSC_PLUGIN_CONFIG_DIR and an outside wrapper.
// @evidence contracts/testing.md#independent-expectations The explicit config-directory channel anchors relative plugin config paths; the authored project-only custom file and severity map independently establish the expected resolution.
// @evidence contracts/testing.md#distinguishing-cases Owns relative explicit config with separate wrapper and channel-set origin; ordinary tsconfig-relative resolution and channel-set discovery are separate entries.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. A project-only custom JSON file and outside wrapper reach LoadRuleConfig under a scoped config-directory environment in-process; resolved severity observes anchoring and testing restores the environment.
func TestLoadRuleConfigResolvesConfigFileRelativeToPluginConfigDirEnv(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(dir, "custom.lint.json"), `{
    "rules": { "no-var": "error" }
  }`)

  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", dir)
  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{"configFile": "custom.lint.json"},
  }, dir, wrapper)
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Fatalf("no-var: want error from the project-relative configFile, got %v", cfg.Severity("no-var"))
  }
}
