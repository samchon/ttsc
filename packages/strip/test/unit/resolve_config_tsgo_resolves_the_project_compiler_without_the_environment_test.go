package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment verifies
// @ttsc/strip's config evaluator finds its compiler in the project being
// compiled.
//
// The evaluator used to read TTSC_TSGO_BINARY and nothing else, so it worked
// only by inheritance from a `ttsx`-launched host: the shipped `ttscserver`
// binary invoked with `--tsgo <path>` exports nothing, and evaluation aborted
// with `ttsc: typescript is required` before a line of the config was read.
// The case sheds both variables first: every existing loader case pins
// TTSC_TTSX_BINARY at a fake launcher, and both Go runners forward the ambient
// environment a `ttsx`-launched suite already carries, so a case that kept them
// could prove only that something upstream set them.
//
//  1. Seed a project holding `typescript` and its platform package.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's own `lib/tsc`.
//
// @evidence contracts/testing.md#behavioral-verification Clears both tool overrides and asserts stripResolveConfigTsgo finds the executable fixture in the project platform package.
// @evidence contracts/testing.md#independent-expectations The independently seeded npm layout supplies TypeScript and its platform sibling lib/tsc path. Platform-name vocabulary is pinned by its separate literal mapping table.
// @evidence contracts/testing.md#distinguishing-cases Owns successful project discovery without overrides; absent TypeScript, platform package and executable each have dedicated negative cases.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripResolveConfigTsgo through linkname and native manifest/stat lookup in the Go process; the empty compiler fixture is never spawned.
func TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.StripRealpathIfPossible(t.TempDir())
  want := shared.SeedProjectTypeScript(t, root)
  config := filepath.Join(root, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")

  if got := shared.StripResolveConfigTsgo(shared.StripConfigToolAnchors(config, root)); got != want {
    t.Fatalf("stripResolveConfigTsgo = %q, want the project compiler %q", got, want)
  }
}
