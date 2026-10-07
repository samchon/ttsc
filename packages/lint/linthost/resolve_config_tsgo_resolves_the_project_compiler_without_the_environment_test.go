package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoResolvesTheProjectCompilerWithoutTheEnvironment verifies
// the Go config evaluator finds its compiler in the project being linted.
//
// The case clears both inherited tool variables so an available parent pin
// cannot mask project-local discovery. It observes the selected path directly;
// it does not launch ttscserver or evaluate a TypeScript config.
//
//  1. Seed a project holding `typescript` and its platform package.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY.
//  3. Assert the resolution names the project's own `lib/tsc`.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo finds the authored platform compiler after both inherited launcher and compiler variables are cleared.
// @evidence contracts/testing.md#independent-expectations Project-local TypeScript and its platform package define a resolvable compiler without a parent launcher environment; seedProjectTypeScript returns the known fixture path, not the resolver result.
// @evidence contracts/testing.md#distinguishing-cases Owns complete local install with no environment assistance; the separate missing-TypeScript and missing-platform entries own their negative cases.
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
