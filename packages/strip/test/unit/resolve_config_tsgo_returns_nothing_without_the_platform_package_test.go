package strip_test

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoReturnsNothingWithoutThePlatformPackage verifies a
// `typescript` install whose platform dependency is missing resolves to nothing.
//
// The boundary between the two resolution hops. `typescript` carries the native
// compiler in an optional per-platform package, so an install made with
// optional dependencies disabled has the manifest and no platform package.
// Returning a path anyway would hand the child a `--binary` that cannot be
// spawned, and replace a clear "reinstall typescript" diagnostic with an exec
// failure.
//
//  1. Seed a project holding only the `typescript` manifest.
//  2. Shed both tool variables.
//  3. Assert the resolution invents no executable path.
//
// @evidence contracts/testing.md#behavioral-verification Creates only a TypeScript manifest and asserts stripResolveConfigTsgo returns empty when the platform sibling package is absent.
// @evidence contracts/testing.md#independent-expectations The native compiler belongs to the platform package. No such fixture manifest exists, so the resolver must not invent an executable path.
// @evidence contracts/testing.md#distinguishing-cases Owns TypeScript-present/platform-absent lookup; requireNoAmbientInstall may skip an ambient platform install. Platform-present/executable-absent has a separate case.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoReturnsNothingWithoutThePlatformPackage is selected from test/unit by the utility runner unit overlay. Runs stripResolveConfigTsgo, platform mapping and manifest traversal in the Go process; no native compiler executes.
func TestResolveConfigTsgoReturnsNothingWithoutThePlatformPackage(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := stripRealpathIfPossible(t.TempDir())
  platform, arch := stripNodePlatformPair()
  requireNoAmbientInstall(t, root, "@typescript/typescript-"+platform+"-"+arch)
  writeFile(
    t,
    filepath.Join(root, "node_modules", "typescript", "package.json"),
    `{"name":"typescript"}`,
  )
  config := filepath.Join(root, "strip.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := stripResolveConfigTsgo(stripConfigToolAnchors(config, root)); got != "" {
    t.Fatalf("stripResolveConfigTsgo = %q, want no compiler when the platform package is absent", got)
  }
}
