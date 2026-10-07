package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
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
// @evidence contracts/testing.md#behavioral-verification Clears tool overrides and asserts stripResolveTtsxLauncher returns ttsx when the project has no ttsc install.
// @evidence contracts/testing.md#independent-expectations The supported no-install fallback is the literal bare command ttsx; no independently seeded launcher exists that would justify a project path.
// @evidence contracts/testing.md#distinguishing-cases Owns absent-install fallback; requireNoAmbientInstall may skip ambient ttsc ancestry. An installed manifest missing its launcher is covered separately.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveTtsxLauncherFallsBackToTheBareCommand is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripResolveTtsxLauncher and the manifest walk in the Go process; the returned command is not executed.
func TestResolveTtsxLauncherFallsBackToTheBareCommand(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.StripRealpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, root, "ttsc")
  project := filepath.Join(root, "project")
  config := filepath.Join(project, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")

  if got := stripResolveTtsxLauncher(shared.StripConfigToolAnchors(config, project)); got != "ttsx" {
    t.Fatalf("stripResolveTtsxLauncher = %q, want the bare ttsx fallback", got)
  }
}
