package strip_test

import (
  "path/filepath"
  "testing"
)

// TestConfigFileResolvesRelativeToPluginConfigDirEnv verifies that a relative
// "configFile" plugin-entry path resolves against TTSC_PLUGIN_CONFIG_DIR when
// the channel is set.
//
// Locks resolveStripConfigFilePath through the shared anchor: when a build
// integration compiles through a generated wrapper tsconfig in a temp
// directory, a relative configFile would otherwise dangle against the temp
// dir and fail with a not-found error.
//
//  1. Seed a project directory holding custom.strip.json and a separate
//     wrapper directory holding only a tsconfig.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and call loadStripConfigMap
//     with configFile "custom.strip.json" and the wrapper tsconfig.
//  3. Assert the project-relative file is loaded.
func TestConfigFileResolvesRelativeToPluginConfigDirEnv(t *testing.T) {
  project := seedProject(t, map[string]string{
    "custom.strip.json": `{"calls":["logger.trace"],"statements":["debugger"]}`,
  })
  wrapper := seedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
  })
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", project)
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip", "configFile": "custom.strip.json"},
    project,
    filepath.Join(wrapper, "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "logger.trace" {
    t.Fatalf("unexpected calls from project-relative configFile: %#v", config["calls"])
  }
}
