package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoFallsBackToTheProjectRootAnchor verifies a config whose
// own ancestry answers nothing still resolves through the resolution root.
//
// The other direction of the anchor order. A config reached through `extends`,
// or named by `configFile`, can live outside the project tree entirely, so its
// upward walk reaches no node_modules at all. The resolution root is the second
// anchor precisely for that shape; without it the fix would only cover configs
// that sit inside the project.
//
//  1. Seed a project whose install sits at the root only.
//  2. Put the config in a sibling tree the project does not contain.
//  3. Assert the root's compiler is still resolved.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo returns the project compiler when the config sits in a sibling tree with no install ancestry.
// @evidence contracts/testing.md#independent-expectations Config-origin lookup precedes project-root fallback; the seeded project executable is an independently known fixture location.
// @evidence contracts/testing.md#distinguishing-cases Owns outside-project config with only the second anchor resolvable; config-anchor precedence is the complementary both-present case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored temporary compiler fixture and sibling config reach configToolAnchors and resolveConfigTsgo in-process; the selected compiler path is observed without running or installing that fixture.
func TestResolveConfigTsgoFallsBackToTheProjectRootAnchor(t *testing.T) {
  shedConfigToolEnvironment(t)
  base := realpathIfPossible(t.TempDir())
  root := filepath.Join(base, "project")
  want := seedProjectTypeScript(t, root)
  config := filepath.Join(base, "shared", "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveConfigTsgo(configToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the project root compiler %q", got, want)
  }
}
