package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment verifies
// the Go config evaluator finds its compiler in the project being linted.
//
// The evaluator used to read TTSC_TSGO_BINARY and nothing else, so it worked
// only by inheritance from a `ttsx`-launched host: the shipped `ttscserver`
// binary invoked with `--tsgo <path>` exports nothing, and evaluation aborted
// with `ttsc: typescript is required` before a line of the config was read.
// The case sheds both variables first, because scripts/test-go-lint.cjs exports
// them into `go test` and that is exactly what masked the defect.
//
//  1. Seed a project holding `typescript` and its platform package.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's own `lib/tsc`.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo finds the authored platform compiler after both inherited launcher and compiler variables are cleared.
// @evidence contracts/testing.md#independent-expectations Project-local TypeScript and its platform package define a resolvable compiler without a parent launcher environment; seedProjectTypeScript returns the known fixture path, not the resolver result.
// @evidence contracts/testing.md#distinguishing-cases Owns complete local install with no environment assistance; missing TypeScript and missing platform package are independently checked negatives.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored TypeScript/platform manifest and executable fixtures reach resolveConfigTsgo with inherited pins cleared in-process; only the resolved path is inspected, without building or running the compiler.
func TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  want := seedProjectTypeScript(t, root)
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveConfigTsgo(configToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the project compiler %q", got, want)
  }
}
