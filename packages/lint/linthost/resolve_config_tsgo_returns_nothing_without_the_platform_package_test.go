package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoReturnsNothingWithoutThePlatformPackage verifies a
// `typescript` install whose platform dependency is missing resolves to nothing.
//
// This checks the boundary between the main manifest and platform-package
// lookup. The fixture authors only the main manifest and guards against an
// ambient platform install. It observes an empty resolver path, without
// asserting a child's argument, spawn failure or diagnostic.
//
//  1. Seed a project holding only the `typescript` manifest.
//  2. Shed both tool variables.
//  3. Assert the resolution invents no executable path.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo leaves the compiler unresolved when a TypeScript manifest exists but its current-platform dependency does not.
// @evidence contracts/testing.md#independent-expectations Optional platform-package absence must not produce a guessed executable; the authored manifest-only installation supplies the independently missing dependency premise.
// @evidence contracts/testing.md#distinguishing-cases Owns the two-hop boundary where the main package resolves but its native platform sibling does not; fully missing and complete installs are separate cases.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored TypeScript-only manifest and absent-platform guard reach resolveConfigTsgo under cleared pins in-process; empty output observes the missing second hop without executing a compiler.
func TestResolveConfigTsgoReturnsNothingWithoutThePlatformPackage(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  platform, arch := nodePlatformPair()
  requireNoAmbientInstall(t, root, "@typescript/typescript-"+platform+"-"+arch)
  writeFile(
    t,
    filepath.Join(root, "node_modules", "typescript", "package.json"),
    `{"name":"typescript"}`,
  )
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveConfigTsgo(configToolAnchors(config, root)); got != "" {
    t.Fatalf("resolveConfigTsgo = %q, want \"\" when the platform package is absent", got)
  }
}
