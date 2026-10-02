package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestResolveTtsxLauncherIgnoresATtscInstallWithoutALauncher verifies a `ttsc`
// package that carries no `lib/launcher/ttsx.js` falls through to the bare
// command.
//
// The launcher is derived from where the manifest resolved rather than
// requested as an exported subpath, so nothing but a stat proves the file is
// there. A source checkout of `ttsc` that has not been built has the manifest
// and no `lib`, and naming that path would spawn a file that does not exist
// instead of the `ttsx` a global install put on PATH.
//
//  1. Install a `ttsc` manifest with no built launcher beside it.
//  2. Shed both tool variables.
//  3. Assert the resolution declines it and keeps the bare command.
//
// @evidence contracts/testing.md#behavioral-verification Seeds a ttsc manifest without lib/launcher/ttsx.js and asserts stripResolveTtsxLauncher returns the bare ttsx fallback.
// @evidence contracts/testing.md#independent-expectations The launcher contract requires its file as well as the package manifest. seedProjectTtscWithoutLauncher independently leaves that known path absent.
// @evidence contracts/testing.md#distinguishing-cases Owns partial installation without a launcher; successful project lookup and complete absence of the package are separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveTtsxLauncherIgnoresATtscInstallWithoutALauncher is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripResolveTtsxLauncher with native fixture stat operations in the Go process; no command is constructed or launched from its result.
func TestResolveTtsxLauncherIgnoresATtscInstallWithoutALauncher(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.StripRealpathIfPossible(t.TempDir())
  missing := shared.SeedProjectTtscWithoutLauncher(t, root)
  config := filepath.Join(root, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")

  if got := stripResolveTtsxLauncher(shared.StripConfigToolAnchors(config, root)); got != "ttsx" {
    t.Fatalf("stripResolveTtsxLauncher = %q, want the bare ttsx fallback when %q does not exist", got, missing)
  }
}
