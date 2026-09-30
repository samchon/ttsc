package banner_test

import (
  "path/filepath"
  "testing"
)

// TestResolveTtsxLauncherResolvesTheProjectLauncherWithoutTheEnvironment
// verifies @ttsc/banner's config evaluator spawns the `ttsc` the project
// installed.
//
// This branch fires one step before the compiler one and had no middle step at
// all: the variable, then a bare `ttsx` that only a global install puts on
// PATH. For the ordinary project-local install the spawn failed with a
// not-found error while the launcher sat in the project's own node_modules.
//
//  1. Seed a project holding `ttsc` and its `lib/launcher/ttsx.js`.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's launcher, not `ttsx`.
//
// @evidence contracts/testing.md#behavioral-verification Clears tool overrides, seeds the ttsc manifest and launcher file, and asserts bannerResolveTtsxLauncher returns the project launcher.
// @evidence contracts/testing.md#independent-expectations The supported npm layout places ttsx.js under lib/launcher. seedProjectTtsc returns the independently written fixture path lookup must find.
// @evidence contracts/testing.md#distinguishing-cases Owns successful project discovery without overrides; explicit override, absent installation and absent launcher have separate owners.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveTtsxLauncherResolvesTheProjectLauncherWithoutTheEnvironment is selected from test/unit by the utility runner unit overlay. Runs bannerResolveTtsxLauncher and bannerConfigToolAnchors in the Go process using ordinary fixture files; the empty launcher is never evaluated.
func TestResolveTtsxLauncherResolvesTheProjectLauncherWithoutTheEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := bannerRealpathIfPossible(t.TempDir())
  want := seedProjectTtsc(t, root)
  config := filepath.Join(root, "banner.config.ts")
  writeFile(t, config, "export default { text: \"from ts\" };\n")

  if got := bannerResolveTtsxLauncher(bannerConfigToolAnchors(config, root)); got != want {
    t.Fatalf("resolveTtsxLauncher = %q, want the project launcher %q", got, want)
  }
}
