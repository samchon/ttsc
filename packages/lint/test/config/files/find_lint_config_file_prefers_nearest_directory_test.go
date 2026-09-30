package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFilePrefersNearestDirectory verifies that a config file in the tsconfig's
// own directory is chosen over a config in a parent directory.
//
// Monorepo packages may override the root lint config with a package-level config. The walk
// must stop as soon as it finds any recognized config in the current directory before ascending.
// A regression that continued past a match would silently apply the wrong (outer) config.
//
// 1. Place a lint.config.mjs at the root and a ttsc-lint.config.cjs inside packages/app.
// 2. Call findLintConfigFile with tsconfig=packages/app/tsconfig.json.
// 3. Assert the nearer packages/app config is selected over the root config.
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile chooses the package-local ttsc-lint.config.cjs over a simultaneously present root lint.config.mjs.
// @evidence contracts/testing.md#independent-expectations The nearest-ancestor contract establishes priority; the authored two-candidate directory tree and literal local path do not reuse the production search to compute the winner.
// @evidence contracts/testing.md#distinguishing-cases Owns two valid candidates at different depths; same-directory ambiguity is rejected in its dedicated test.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Two authored config candidates at different depths reach findLintConfigFile directly in the shared Go process; exact path selection needs no script evaluation or native build.
func TestFindLintConfigFilePrefersNearestDirectory(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "lint.config.mjs"), "export default {};")
  writeFile(t, filepath.Join(nested, "ttsc-lint.config.cjs"), "module.exports = {};")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(nested, "ttsc-lint.config.cjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
