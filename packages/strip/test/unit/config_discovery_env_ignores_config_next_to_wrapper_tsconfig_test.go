package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigDiscoveryEnvIgnoresConfigNextToWrapperTsconfig verifies that a
// strip.config planted next to a generated wrapper tsconfig is not honored
// once TTSC_PLUGIN_CONFIG_DIR names the real project.
//
// Guards the temp-walk hazard of the wrapper-tsconfig layout: any
// strip.config.* on the walk above the OS temp directory would otherwise be
// honored for the build. With the explicit anchor the wrapper's directory
// (and its ancestry) must never enter the discovery walk.
//
//  1. Seed a wrapper directory holding a tsconfig.json plus a decoy
//     strip.config.json, and a project directory with its own config.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and call loadStripConfigMap
//     with the wrapper tsconfig.
//  3. Assert the project's call list wins and the decoy's never appears.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripLoadStripConfigMap with project/wrapper JSON configs present and asserts logger.trace from the project rather than wrapper console.info.
// @evidence contracts/testing.md#independent-expectations TTSC_PLUGIN_CONFIG_DIR outranks wrapper ancestry. Distinct literal calls lists expose the wrong config without using resolver output as an oracle.
// @evidence contracts/testing.md#distinguishing-cases Owns the populated wrapper decoy; environment discovery without a wrapper candidate and ordinary upward discovery have separate owners.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigDiscoveryEnvIgnoresConfigNextToWrapperTsconfig is selected from test/unit by the utility runner unit overlay. Runs stripLoadStripConfigMap, PluginConfigBaseDir, DiscoverConfigFile and JSON decoding in the Go process; neither config invokes Node or a compiler.
func TestConfigDiscoveryEnvIgnoresConfigNextToWrapperTsconfig(t *testing.T) {
  project := shared.SeedProject(t, map[string]string{
    "strip.config.json": `{"calls":["logger.trace"],"statements":[]}`,
  })
  wrapper := shared.SeedProject(t, map[string]string{
    "tsconfig.json":     `{"compilerOptions":{"target":"ES2022"}}`,
    "strip.config.json": `{"calls":["console.info"],"statements":[]}`,
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
    t.Fatalf("expected project config to win over wrapper decoy: %#v", config["calls"])
  }
}
