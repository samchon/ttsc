package banner_test

import (
  "path/filepath"
  "testing"
)

// TestResolveTtsxLauncherFallsBackToTheBareCommand verifies an unresolvable
// project still produces the bare `ttsx` name.
//
// The negative twin of the project-anchored launcher resolution, and the
// guarantee that the fix adds a middle step rather than replacing the old last
// resort. A global `ttsc` install puts `ttsx` on PATH with nothing in any
// project's node_modules, so inventing a path here would break the one shape
// that worked before.
//
//  1. Seed a project with no `ttsc` install in its ancestry.
//  2. Shed both tool variables.
//  3. Assert the bare command name survives.
//
// @evidence contracts/testing.md#behavioral-verification Clears tool overrides and asserts bannerResolveTtsxLauncher returns ttsx when the project has no ttsc install.
// @evidence contracts/testing.md#independent-expectations The supported no-install fallback is the literal bare command ttsx; no independently seeded launcher exists that would justify a project path.
// @evidence contracts/testing.md#distinguishing-cases Owns absent-install fallback; requireNoAmbientInstall may skip ambient ttsc ancestry. An installed manifest missing its launcher is covered separately.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveTtsxLauncherFallsBackToTheBareCommand is selected from test/unit by the utility runner unit overlay. Runs bannerResolveTtsxLauncher and the manifest walk in the Go process; the returned command is not executed.
func TestResolveTtsxLauncherFallsBackToTheBareCommand(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := bannerRealpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, root, "ttsc")
  project := filepath.Join(root, "project")
  config := filepath.Join(project, "banner.config.ts")
  writeFile(t, config, "export default { text: \"from ts\" };\n")

  if got := bannerResolveTtsxLauncher(bannerConfigToolAnchors(config, project)); got != "ttsx" {
    t.Fatalf("resolveTtsxLauncher = %q, want the bare ttsx fallback", got)
  }
}
