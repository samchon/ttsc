package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigHonorsPluginConfigDirEnv verifies that lint config
// discovery anchors at the launcher's TTSC_PLUGIN_CONFIG_DIR channel as its
// single origin when the channel is set.
//
// The cwd fallback already rescues the wrapper-tsconfig embedding shape, but
// it walks the wrapper's temp-dir ancestry first, so a lint config planted
// above the OS temp dir would win over the project's own. With the explicit
// anchor the wrapper's directory must never enter the walk: a decoy config
// next to the wrapper tsconfig pins that.
//
//  1. Seed a project dir with lint.config.json and a wrapper dir with a
//     tsconfig.json plus a decoy lint.config.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and call LoadRuleConfig with
//     the wrapper tsconfig.
//  3. Assert the project's rules are loaded, not the decoy's.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig uses TTSC_PLUGIN_CONFIG_DIR to load no-var/error and reject the competing wrapper no-console/error configuration.
// @evidence contracts/testing.md#independent-expectations The explicit plugin config-directory channel is the sole search origin; distinct authored project and wrapper rules establish both winning and forbidden outcomes.
// @evidence contracts/testing.md#distinguishing-cases Owns channel-set discovery with a plausible wrapper decoy; channel-absent wrapper and cwd-fallback selection are checked separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Two competing temporary JSON configs reach LoadRuleConfig with a scoped TTSC_PLUGIN_CONFIG_DIR override in-process; project and decoy severities observe origin selection, and testing restores the environment.
func TestLoadRuleConfigHonorsPluginConfigDirEnv(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(wrapperDir, "lint.config.json"), `{
    "rules": { "no-console": "error" }
  }`)
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-var": "error" }
  }`)

  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", dir)
  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, wrapper)
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Fatalf("no-var: want error from the project's config, got %v", cfg.Severity("no-var"))
  }
  if cfg.Severity("no-console") == SeverityError {
    t.Fatal("no-console: wrapper decoy config must not be honored")
  }
}
