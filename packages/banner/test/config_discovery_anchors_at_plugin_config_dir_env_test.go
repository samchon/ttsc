package banner_test

import (
  "path/filepath"
  "testing"
)

// TestConfigDiscoveryAnchorsAtPluginConfigDirEnv verifies that banner config
// auto-discovery anchors at the launcher's TTSC_PLUGIN_CONFIG_DIR channel
// instead of the tsconfig directory when the channel is set.
//
// Locks the explicit-anchor branch in tsconfigBaseDir (via
// driver.PluginConfigBaseDir). Build integrations such as @ttsc/unplugin
// compile through a generated wrapper tsconfig in the system temp directory;
// without the channel the upward walk starts at the temp tree and banner
// fails hard with "no banner.config found" even though the file sits next to
// the real tsconfig. A decoy next to the wrapper additionally pins that the
// wrapper's directory never enters the walk.
//
//  1. Seed a project directory holding banner.config.json and a wrapper
//     directory holding a tsconfig.json plus a decoy banner.config.json.
//  2. Set TTSC_PLUGIN_CONFIG_DIR to the project and discover from the
//     wrapper tsconfig.
//  3. Assert the project's config file is returned, not the decoy.
func TestConfigDiscoveryAnchorsAtPluginConfigDirEnv(t *testing.T) {
  project := t.TempDir()
  wrapper := t.TempDir()
  writeFile(t, filepath.Join(project, "banner.config.json"), `{"text":"project"}`)
  writeFile(t, filepath.Join(wrapper, "tsconfig.json"), "{}")
  writeFile(t, filepath.Join(wrapper, "banner.config.json"), `{"text":"decoy"}`)

  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", project)
  location, err := bannerFindBannerConfigFile(project, filepath.Join(wrapper, "tsconfig.json"))
  if err != nil {
    t.Fatalf("findBannerConfigFile error: %v", err)
  }
  if location != filepath.Join(project, "banner.config.json") {
    t.Fatalf("expected project config, got %q", location)
  }
}
