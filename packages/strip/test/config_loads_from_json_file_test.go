package strip_test

import (
  "path/filepath"
  "testing"
)

// TestConfigLoadsFromJSONFile verifies that the strip driver reads configuration
// from an explicit JSON config file referenced via the configFile key.
//
// Locks the explicit-configFile path in loadStripConfigMap: when the plugin
// entry carries a "configFile" key, the driver must resolve the path relative
// to the tsconfig directory and parse the JSON file, not fall back to defaults
// or walk upward to discover a file.
//
//  1. Write a strip.config.json with explicit calls and statements into a temp
//     directory that also holds a tsconfig.json.
//  2. Call loadStripConfigMap with a plugin entry specifying "configFile".
//  3. Assert the returned config map contains the expected calls and statements.
func TestConfigLoadsFromJSONFile(t *testing.T) {
  root := seedProject(t, map[string]string{
    "tsconfig.json":     `{"compilerOptions":{"target":"ES2022"}}`,
    "strip.config.json": `{"calls":["trace"],"statements":["debugger"]}`,
  })
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip", "configFile": "strip.config.json"},
    root,
    filepath.Join(root, "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "trace" {
    t.Fatalf("unexpected calls: %#v", config["calls"])
  }
  statements, ok := config["statements"].([]any)
  if !ok || len(statements) != 1 || statements[0] != "debugger" {
    t.Fatalf("unexpected statements: %#v", config["statements"])
  }
}
