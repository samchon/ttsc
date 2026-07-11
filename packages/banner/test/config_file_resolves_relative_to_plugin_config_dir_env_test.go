package banner_test

import (
  "path/filepath"
  "testing"
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
func TestConfigFileResolvesRelativeToPluginConfigDirEnv(t *testing.T) {
  project := t.TempDir()
  wrapper := t.TempDir()
  writeFile(t, filepath.Join(wrapper, "tsconfig.json"), "{}")

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
