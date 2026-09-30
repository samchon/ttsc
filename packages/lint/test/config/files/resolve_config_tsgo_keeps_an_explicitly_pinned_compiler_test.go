package linthost

import (
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoKeepsAnExplicitlyPinnedCompiler verifies an explicit
// TTSC_TSGO_BINARY still wins over the project's own install.
//
// Anchoring the resolution on the project is a fallback, not a replacement: an
// embedder that pins a compiler (a cross-version harness, a benchmark cell)
// must keep pinning it. The project here can answer, so the assertion pins the
// precedence rather than the absence of an alternative.
//
//  1. Seed a project holding a resolvable `typescript` install.
//  2. Point TTSC_TSGO_BINARY at a different path.
//  3. Assert the pinned path is returned verbatim.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo returns TTSC_TSGO_BINARY verbatim even when a different project compiler can resolve.
// @evidence contracts/testing.md#independent-expectations An explicit compiler pin outranks automatic project discovery; the distinct authored pinned and installed fixture paths establish the independent priority oracle.
// @evidence contracts/testing.md#distinguishing-cases Owns pin-versus-available-install competition, preventing an absence-only precedence test; unpinned project resolution is covered separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored local compiler fixture and scoped TTSC_TSGO_BINARY pin reach resolveConfigTsgo in-process; exact selected path observes precedence without running the compiler, and testing restores the environment.
func TestResolveConfigTsgoKeepsAnExplicitlyPinnedCompiler(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  project := seedProjectTypeScript(t, root)
  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  pinned := filepath.Join(root, "pinned", "tsc")
  t.Setenv("TTSC_TSGO_BINARY", pinned)

  got := resolveConfigTsgo(configToolAnchors(config, root))
  if got == project {
    t.Fatalf("resolveConfigTsgo took the project compiler %q over the pinned %q", project, pinned)
  }
  if got != pinned {
    t.Fatalf("resolveConfigTsgo = %q, want the pinned %q", got, pinned)
  }
}
