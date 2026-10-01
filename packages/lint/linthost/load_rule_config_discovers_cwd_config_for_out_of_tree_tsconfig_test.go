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
//  1. Seed a project dir with lint.config.json and a separate wrapper dir with
//     only a tsconfig.json.
//  2. Call LoadRuleConfig with cwd=project and tsconfigPath=wrapper.
//  3. Assert the project's rules are loaded.
//
// @evidence contracts/testing.md#behavioral-verification LoadRuleConfig loads no-var at error severity from cwd when a separate wrapper-tsconfig ancestry has no lint config.
// @evidence contracts/testing.md#independent-expectations The supported out-of-tree embedding path falls back to cwd; the sole authored no-var/error config establishes the independently expected resulting severity.
// @evidence contracts/testing.md#distinguishing-cases Owns wrapper absence with project availability; wrapper-priority and explicit config-directory decoy cases provide the opposite branches.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored project JSON and a separate wrapper tsconfig reach LoadRuleConfig directly in-process; resulting no-var severity observes fallback without a child compiler.
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
