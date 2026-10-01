package banner_test

import (
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestConfigPathDiscovery verifies banner config path resolution and upward search.
//
// A project keeps its banner.config file next to tsconfig or in an ancestor
// directory. This pins the tsconfig-relative base directory and the
// duplicate-file rejection that prevents ambiguous discovery.
//
// 1. Resolve explicit config paths against cwd and relative tsconfig locations.
// 2. Discover a config file from the tsconfig directory and then from a parent.
// 3. Assert duplicate candidates and missing configs produce stable outcomes.
//
// @evidence contracts/testing.md#behavioral-verification Exercises banner base-dir/path helpers, ancestor/nearer discovery, duplicate errors and allowed filename recognition.
// @evidence contracts/testing.md#independent-expectations Literal root/project paths establish tsconfig-relative resolution and nearest-directory precedence; the seven config names and configFile remedy follow the banner contract.
// @evidence contracts/testing.md#distinguishing-cases Owns relative/empty tsconfig, relative/absolute config path, ancestor/nearer candidate, ambiguity, no candidate, accepted seven suffixes and rejected TOML. Located scripts are not evaluated.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigPathDiscovery is selected from test/unit by the utility runner unit overlay. Runs bannerTsconfigBaseDir, bannerResolveBannerConfigPath, bannerFindBannerConfigFile and bannerIsBannerConfigFileName through Go linkname adapters using path/stat fixtures only.
func TestConfigPathDiscovery(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "packages", "demo")
  tsconfig := filepath.Join(project, "tsconfig.json")
  shared.WriteFile(t, tsconfig, "{}")
  shared.WriteFile(t, filepath.Join(root, "banner.config.js"), `export default { text: "root" };`)

  if got := bannerTsconfigBaseDir(root, "packages/demo/tsconfig.json"); got != project {
    t.Fatalf("relative tsconfig base mismatch: %q", got)
  }
  if got := bannerTsconfigBaseDir(root, ""); got != root {
    t.Fatalf("empty tsconfig base mismatch: %q", got)
  }
  if got := bannerResolveBannerConfigPath("banner.config.js", root, "packages/demo/tsconfig.json"); got != filepath.Join(project, "banner.config.js") {
    t.Fatalf("relative config path mismatch: %q", got)
  }
  absolute := filepath.Join(root, "absolute", "banner.config.js")
  if got := bannerResolveBannerConfigPath(absolute, root, "packages/demo/tsconfig.json"); got != absolute {
    t.Fatalf("absolute config path mismatch: %q", got)
  }

  location, _, err := bannerFindBannerConfigFile(root, "packages/demo/tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  if location != filepath.Join(root, "banner.config.js") {
    t.Fatalf("discovered parent config mismatch: %q", location)
  }
  shared.WriteFile(t, filepath.Join(project, "banner.config.cjs"), `module.exports = { text: "project" };`)
  location, _, err = bannerFindBannerConfigFile(root, "packages/demo/tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  if location != filepath.Join(project, "banner.config.cjs") {
    t.Fatalf("discovered project config mismatch: %q", location)
  }
  shared.WriteFile(t, filepath.Join(project, "banner.config.mjs"), `export default { text: "duplicate" };`)
  if _, _, err := bannerFindBannerConfigFile(root, "packages/demo/tsconfig.json"); err == nil ||
    !strings.Contains(err.Error(), "multiple banner config files") ||
    !strings.Contains(err.Error(), "configFile") {
    t.Fatalf("expected duplicate config error naming files and configFile, got %v", err)
  }
  if location, _, err := bannerFindBannerConfigFile(t.TempDir(), ""); err != nil || location != "" {
    t.Fatalf("missing config mismatch: location=%q err=%v", location, err)
  }

  for _, name := range []string{"banner.config.json", "banner.config.js", "banner.config.cjs", "banner.config.mjs", "banner.config.ts", "banner.config.cts", "banner.config.mts"} {
    if !bannerIsBannerConfigFileName(name) {
      t.Fatalf("expected %s to be accepted", name)
    }
  }
  if bannerIsBannerConfigFileName("banner.config.toml") {
    t.Fatal("unexpected toml config acceptance")
  }
}
