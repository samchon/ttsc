package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestResolveConfigTsgoReturnsNothingWithoutTheCompilerExecutable verifies a
// platform package that carries no `lib/tsc` resolves to nothing.
//
// One step past the missing-platform-package boundary, and the reason the last
// hop stats the file instead of trusting the layout: a partially unpacked or
// hand-pruned platform package has its manifest and no executable. Naming the
// path anyway would turn a reinstall diagnostic into an exec failure inside the
// child, which reads as a ttsc bug rather than a broken install.
//
//  1. Seed both manifests and stop before writing the executable.
//  2. Shed both tool variables.
//  3. Assert the resolution declines the incomplete install.
//
// @evidence contracts/testing.md#behavioral-verification Seeds TypeScript and platform manifests without lib/tsc, then asserts stripResolveConfigTsgo returns empty rather than the missing executable path.
// @evidence contracts/testing.md#independent-expectations A platform manifest alone does not establish a compiler executable. seedProjectTypeScriptWithoutCompiler independently omits that known file.
// @evidence contracts/testing.md#distinguishing-cases Owns an install missing only the executable; full install success and missing platform package are covered separately.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoReturnsNothingWithoutTheCompilerExecutable is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripResolveConfigTsgo with ordinary manifest/stat fixtures in the Go process; no spawn failure is substituted for the resolution assertion.
func TestResolveConfigTsgoReturnsNothingWithoutTheCompilerExecutable(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.StripRealpathIfPossible(t.TempDir())
  missing := shared.SeedProjectTypeScriptWithoutCompiler(t, root)
  config := filepath.Join(root, "strip.config.ts")
  shared.WriteFile(t, config, "export default {};\n")

  if got := shared.StripResolveConfigTsgo(shared.StripConfigToolAnchors(config, root)); got != "" {
    t.Fatalf("stripResolveConfigTsgo = %q, want no compiler when %q does not exist", got, missing)
  }
}
