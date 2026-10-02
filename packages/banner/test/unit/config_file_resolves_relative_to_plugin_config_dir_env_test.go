package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestConfigFileResolvesRelativeToPluginConfigDirEnv verifies that a relative
// "configFile" plugin-entry path resolves against TTSC_PLUGIN_CONFIG_DIR when
// the channel is set.
//
// Locks resolveBannerConfigPath through the shared anchor: when a build
// integration compiles through a generated wrapper tsconfig in a temp
// directory, a relative configFile would otherwise dangle against the temp
// dir and fail with a not-found error.
//
//  1. Seed a project directory and a separate wrapper directory holding only
//     a tsconfig.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and resolve a relative
//     "banner.config.json" from the wrapper tsconfig.
//  3. Assert the path resolves under the project directory.
//
// @evidence contracts/testing.md#behavioral-verification Calls bannerResolveBannerConfigPath for banner.config.json with a wrapper tsconfig and project override; the result must join the project directory.
// @evidence contracts/testing.md#independent-expectations Relative configFile follows TTSC_PLUGIN_CONFIG_DIR when set. The independently constructed project path differs from the wrapper path.
// @evidence contracts/testing.md#distinguishing-cases Owns relative configFile resolution with an environment project anchor; absolute and no-override choices are covered by TestConfigPathDiscovery.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigFileResolvesRelativeToPluginConfigDirEnv is selected from test/unit by the root test:go command (`go test ./packages/banner/...`, which excludes the e2e-tagged test/e2e). Runs bannerResolveBannerConfigPath and PluginConfigBaseDir in the Go process with testing-restored environment; no config, compiler or launcher is loaded.
func TestConfigFileResolvesRelativeToPluginConfigDirEnv(t *testing.T) {
  project := t.TempDir()
  wrapper := t.TempDir()
  shared.WriteFile(t, filepath.Join(wrapper, "tsconfig.json"), "{}")

  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", project)
  got := bannerResolveBannerConfigPath(
    "banner.config.json",
    project,
    filepath.Join(wrapper, "tsconfig.json"),
  )
  if got != filepath.Join(project, "banner.config.json") {
    t.Fatalf("expected project-relative config path, got %q", got)
  }
}
