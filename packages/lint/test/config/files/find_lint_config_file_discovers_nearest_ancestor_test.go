package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileDiscoversNearestAncestor verifies that when no config file exists in
// the tsconfig directory itself, discovery climbs up to the nearest ancestor that contains one.
//
// Monorepo packages frequently share a root ESLint config but have per-package tsconfigs. The
// walk must start from the tsconfig's directory and ascend, not from cwd. A regression that
// walked from cwd upward would fail for packages whose tsconfig lives outside cwd.
//
// 1. Place an eslint.config.mjs at the repo root and a tsconfig inside packages/app.
// 2. Call findLintConfigFile with cwd=root and tsconfig=packages/app/tsconfig.json.
// 3. Assert the root eslint.config.mjs is discovered.
func TestFindLintConfigFileDiscoversNearestAncestor(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "eslint.config.mjs"), "export default [];")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(dir, "eslint.config.mjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
