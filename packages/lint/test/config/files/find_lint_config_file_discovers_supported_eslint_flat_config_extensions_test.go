package linthost

import (
  "path/filepath"
  "testing"
)

// TestFindLintConfigFileDiscoversSupportedESLintFlatConfigExtensions verifies that all six
// recognized eslint.config.* extensions are individually accepted by the discovery walk.
//
// The six extensions are: .js, .mjs, .cjs, .ts, .mts, .cts. Discovery must recognize each to
// match the subset of extensions that ESLint's own flat-config loader accepts. A regression that
// dropped any extension would leave projects using that format without auto-discovery. Each
// sub-test exercises one extension in isolation to make regressions easy to pinpoint.
//
// 1. For each extension, write a tsconfig.json and an eslint.config.<ext> in a fresh temp dir.
// 2. Call findLintConfigFile.
// 3. Assert the eslint.config.<ext> file is the discovered path.
func TestFindLintConfigFileDiscoversSupportedESLintFlatConfigExtensions(t *testing.T) {
  for _, name := range []string{
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
  } {
    t.Run(name, func(t *testing.T) {
      dir := t.TempDir()
      writeFile(t, filepath.Join(dir, "tsconfig.json"), "{}")
      writeFile(t, filepath.Join(dir, name), "export default [];")

      discovered, err := findLintConfigFile(dir, "tsconfig.json")
      if err != nil {
        t.Fatalf("findLintConfigFile: %v", err)
      }
      if discovered != filepath.Join(dir, name) {
        t.Fatalf("unexpected discovery path: %s", discovered)
      }
    })
  }
}
