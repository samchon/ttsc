package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileDiscoversNearestAncestor verifies that when no config file exists in
// the tsconfig directory itself, discovery climbs up to the nearest ancestor that contains one.
//
// Monorepo packages frequently share a root lint config but have per-package tsconfigs. The
// absent local config must not stop discovery before the shared root is reached.
// Search-origin precedence is distinguished by the separate nearest-directory and outside-cwd cases.
//
// 1. Place a lint.config.mjs at the repo root and a tsconfig inside packages/app.
// 2. Call findLintConfigFile with cwd=root and tsconfig=packages/app/tsconfig.json.
// 3. Assert the root lint.config.mjs is discovered.
//
// @evidence contracts/testing.md#behavioral-verification findLintConfigFile returns the shared root config when packages/app contains only its tsconfig. This fixture does not distinguish a cwd-anchored walk because cwd is that same root; the separate nearest-directory and outside-cwd cases distinguish search-origin mistakes.
// @evidence contracts/testing.md#independent-expectations The authored nested layout has exactly one recognized lint.config.mjs at its ancestor; the literal fixture root establishes the expected selected path independently of the search.
// @evidence contracts/testing.md#distinguishing-cases Owns the missing-local/present-ancestor branch; nearest-directory and outside-cwd priority have separate tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry supplies a temporary root config and nested tsconfig to findLintConfigFile, observing the selected path directly in the shared lint process; the discovered script contents are not evaluated or compiled.
func TestFindLintConfigFileDiscoversNearestAncestor(t *testing.T) {
  dir := t.TempDir()
  nested := filepath.Join(dir, "packages", "app")
  writeFile(t, filepath.Join(dir, "lint.config.mjs"), "export default {};")
  writeFile(t, filepath.Join(nested, "tsconfig.json"), "{}")

  discovered, err := findLintConfigFile(dir, filepath.Join("packages", "app", "tsconfig.json"))
  if err != nil {
    t.Fatalf("findLintConfigFile: %v", err)
  }
  if discovered != filepath.Join(dir, "lint.config.mjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}
