package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigDiscoveryAnchorsAtPluginConfigDirEnv verifies that the strip driver
// anchors config auto-discovery at the launcher's TTSC_PLUGIN_CONFIG_DIR
// channel instead of the tsconfig directory when the channel is set.
//
// Locks the explicit-anchor branch in stripDiscoveryBaseDir (via
// driver.PluginConfigBaseDir). Build integrations such as @ttsc/unplugin
// compile through a generated wrapper tsconfig in the system temp directory;
// without the channel the upward walk starts at the temp tree, never reaches
// the project, and strip silently falls back to its built-in defaults.
//
//  1. Seed a project directory holding strip.config.json and a separate
//     wrapper directory holding only a tsconfig.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and call loadStripConfigMap
//     with the wrapper tsconfig.
//  3. Assert the project's configured call list is returned, not defaults.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap with a project override and wrapper tsconfig and asserts the project JSON config supplies exactly logger.trace.
// @evidence contracts/testing.md#independent-expectations The explicit project directory must find the JSON fixture despite wrapper ancestry. Its literal calls list establishes the expected selected value.
// @evidence contracts/testing.md#distinguishing-cases Owns environment discovery without a wrapper config; a populated wrapper decoy is owned by TestConfigDiscoveryEnvIgnoresConfigNextToWrapperTsconfig.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigDiscoveryAnchorsAtPluginConfigDirEnv is selected from test/unit by the utility runner unit overlay. Runs stripLoadStripConfigMap, base-dir/discovery and native JSON loading in the Go process; fixture tsconfig text is not loaded by a compiler.
func TestConfigDiscoveryAnchorsAtPluginConfigDirEnv(t *testing.T) {
  project := shared.SeedProject(t, map[string]string{
    "strip.config.json": `{"calls":["logger.trace"],"statements":[]}`,
  })
  wrapper := shared.SeedProject(t, map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022"}}`,
  })
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", project)
  config, err := stripLoadStripConfigMap(
    map[string]any{"transform": "@ttsc/strip"},
    project,
    filepath.Join(wrapper, "tsconfig.json"),
  )
  if err != nil {
    t.Fatalf("loadStripConfigMap error: %v", err)
  }
  calls, ok := config["calls"].([]any)
  if !ok || len(calls) != 1 || calls[0] != "logger.trace" {
    t.Fatalf("unexpected calls from project config: %#v", config["calls"])
  }
}
