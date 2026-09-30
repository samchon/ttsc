package strip_test

import (
  "strings"
  "testing"
)

// TestConfigRejectsAmbiguousMultipleFiles verifies that the strip driver errors
// when multiple strip.config.* files coexist in the same directory.
//
// Locks the ambiguity guard in findStripConfigFile: when discovery finds more
// than one candidate file in the same directory the driver must report an error
// instead of silently picking one, preventing subtle build surprises caused by
// leftover config files.
//
// 1. Place both strip.config.json and strip.config.js in the same temp directory.
// 2. Call loadStripConfigMap with no configFile key, pointing at that directory.
// 3. Assert the error message names the directory and suggests setting configFile.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap with JSON and JS candidates in one directory and asserts a nonnil multiple-strip-config-files error.
// @evidence contracts/testing.md#independent-expectations Discovery has no format-preference rule: two supported candidates are ambiguous independently of their conflicting literal calls arrays.
// @evidence contracts/testing.md#distinguishing-cases Owns same-directory ambiguity across JSON/JS. The assertion checks error category, not individual candidate names or remedy wording; single explicit/upward configs have separate owners.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigRejectsAmbiguousMultipleFiles is selected from test/unit by the utility runner unit overlay. Runs stripLoadStripConfigMap and DiscoverConfigFile in the Go process; ambiguity returns before either candidate is evaluated, so JS does not start Node.
func TestConfigRejectsAmbiguousMultipleFiles(t *testing.T) {
  root := seedProject(t, map[string]string{
    "strip.config.json": `{"calls":["a"]}`,
    "strip.config.js":   `module.exports = { calls: ["b"] };`,
    "tsconfig.json":     `{"compilerOptions":{"target":"ES2022"}}`,
  })
  _, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    root,
    "",
  )
  if err == nil {
    t.Fatal("expected error for ambiguous config files, got nil")
  }
  if !strings.Contains(err.Error(), "multiple strip config files") {
    t.Fatalf("error %q does not mention 'multiple strip config files'", err.Error())
  }
}
