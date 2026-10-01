package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
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
// @evidence contracts/testing.md#behavioral-verification Clears tool overrides and calls bannerResolveConfigTsgo for a project containing only its config file; it must return no compiler.
// @evidence contracts/testing.md#independent-expectations A config file supplies no TypeScript install. The empty result follows the resolver contract and the independently absent package layout.
// @evidence contracts/testing.md#distinguishing-cases Owns missing-TypeScript resolution; requireNoAmbientInstall can skip polluted ancestry. Missing platform and executable after a TypeScript install have separate cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoReturnsNothingWithoutAProjectTypeScript is selected from test/unit by the utility runner unit overlay. Runs bannerResolveConfigTsgo and its manifest walk in the Go process; fixture and environment state are testing-owned and no compiler or launcher starts.
func TestResolveConfigTsgoReturnsNothingWithoutAProjectTypeScript(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.BannerRealpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, root, "typescript")
  project := filepath.Join(root, "project")
  config := filepath.Join(project, "banner.config.ts")
  shared.WriteFile(t, config, "export default { text: \"from ts\" };\n")

  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, project)); got != "" {
    t.Fatalf("resolveConfigTsgo = %q, want no compiler for a project with no typescript install", got)
  }
}
