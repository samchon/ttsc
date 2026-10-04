package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveTtsxLauncherResolvesTheProjectLauncherWithoutTheEnvironment
// verifies the Go config resolver selects the `ttsc` launcher the project installed.
//
// The authored local launcher must be selected before the bare-command
// fallback when inherited pins are absent. This path-only assertion does not
// establish launcher execution or a former spawn failure.
//
//  1. Seed a project holding `ttsc` and its `lib/launcher/ttsx.js`.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's launcher, not `ttsx`.
//
// @evidence contracts/testing.md#behavioral-verification resolveTtsxLauncher returns the fixture ttsc launcher after compiler and launcher environment variables are removed.
// @evidence contracts/testing.md#independent-expectations A local package manifest and launcher define the supported project-local resolution route; seedProjectTtsc supplies its known path independently of the resolver.
// @evidence contracts/testing.md#distinguishing-cases Owns local installation without inherited environment; explicit pin and absent-install bare fallback are complementary cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit supplies an authored ttsc manifest and launcher file to resolveTtsxLauncher with inherited pins cleared, observing only the selected path in-process; the fixture launcher is neither installed by a package manager nor executed.
func TestResolveTtsxLauncherResolvesTheProjectLauncherWithoutTheEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  want := seedProjectTtsc(t, root)
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveTtsxLauncher(configToolAnchors(config, root)); got != want {
    t.Fatalf("resolveTtsxLauncher = %q, want the project launcher %q", got, want)
  }
}
