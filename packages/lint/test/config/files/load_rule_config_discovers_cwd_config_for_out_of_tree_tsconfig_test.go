package linthost

import (
  "path/filepath"
  "testing"
)

// TestLoadRuleConfigDiscoversCwdConfigForOutOfTreeTsconfig verifies the full
// LoadRuleConfig path resolves a project's lint config when the tsconfig lives
// outside the project tree.
//
// This is the TtscCompiler embedding shape: a rollup config writes a wrapper
// tsconfig into the system temp dir that `extends` the real project tsconfig,
// then compiles with cwd/projectRoot set to the project. The lint sidecar
// receives the wrapper path as --tsconfig and the project as --cwd; discovery
// must land on the project's config via the cwd fallback instead of failing
// with a missing-config error.
//
// 1. Seed a project dir with lint.config.json and a separate wrapper dir with
//    only a tsconfig.json.
// 2. Call LoadRuleConfig with cwd=project and tsconfigPath=wrapper.
// 3. Assert the project's rules are loaded.
func TestLoadRuleConfigDiscoversCwdConfigForOutOfTreeTsconfig(t *testing.T) {
  dir := t.TempDir()
  wrapperDir := t.TempDir()
  wrapper := filepath.Join(wrapperDir, "tsconfig.json")
  writeFile(t, wrapper, "{}")
  writeFile(t, filepath.Join(dir, "lint.config.json"), `{
    "rules": { "no-var": "error" }
  }`)

  cfg, err := LoadRuleConfig(&PluginEntry{
    Config: map[string]any{},
  }, dir, wrapper)
  if err != nil {
    t.Fatalf("LoadRuleConfig: %v", err)
  }
  if cfg.Severity("no-var") != SeverityError {
    t.Fatalf("no-var: want error from the cwd project's config, got %v", cfg.Severity("no-var"))
  }
}
