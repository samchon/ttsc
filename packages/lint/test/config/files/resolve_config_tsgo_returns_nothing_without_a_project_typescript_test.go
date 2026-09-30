package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoReturnsNothingWithoutAProjectTypeScript verifies an
// unresolvable project still hands the child no `--binary`.
//
// The negative twin of the project-anchored resolution. An empty result is the
// unchanged last resort: the child re-derives the compiler itself and its own
// `ttsc: typescript is required` names the missing package, which is a better
// diagnostic than a guessed path that does not exist.
//
//  1. Seed a project with no node_modules anywhere in its ancestry.
//  2. Shed both tool variables.
//  3. Assert the resolution invents nothing.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo returns no compiler path when no TypeScript manifest exists in the config or root ancestry.
// @evidence contracts/testing.md#independent-expectations The resolver must not invent an executable for an absent package; the authored empty tree and fictional-free ambient-install guard establish the missing-package premise.
// @evidence contracts/testing.md#distinguishing-cases Owns both tool variables absent and no TypeScript package; a present manifest with absent platform dependency is the companion negative.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored empty project with an ambient-install guard reaches resolveConfigTsgo under cleared tool pins in-process; the empty result is observed without a child compiler or consumer install.
func TestResolveConfigTsgoReturnsNothingWithoutAProjectTypeScript(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, root, "typescript")
  config := filepath.Join(root, "project", "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveConfigTsgo(configToolAnchors(config, filepath.Join(root, "project"))); got != "" {
    t.Fatalf("resolveConfigTsgo = %q, want \"\" for a project with no typescript install", got)
  }
}
