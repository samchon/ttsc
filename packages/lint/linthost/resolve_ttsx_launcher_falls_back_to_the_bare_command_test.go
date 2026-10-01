package linthost

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
// @evidence contracts/testing.md#behavioral-verification resolveTtsxLauncher returns the bare ttsx fallback when no project installation or environment pin is available.
// @evidence contracts/testing.md#independent-expectations The supported PATH fallback remains the literal ttsx command instead of a fabricated local path; the empty fixture ancestry is guarded against ambient ttsc installations.
// @evidence contracts/testing.md#distinguishing-cases Owns absent-package fallback after clearing both tool variables; local installation and explicit pinning supply its positive counterparts.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored empty project with an ambient ttsc guard reaches resolveTtsxLauncher under cleared pins in-process; the bare ttsx string is inspected without attempting to spawn it.
func TestResolveTtsxLauncherFallsBackToTheBareCommand(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, root, "ttsc")
  config := filepath.Join(root, "project", "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  got := resolveTtsxLauncher(configToolAnchors(config, filepath.Join(root, "project")))
  if got != "ttsx" {
    t.Fatalf("resolveTtsxLauncher = %q, want the bare \"ttsx\" fallback", got)
  }
}
