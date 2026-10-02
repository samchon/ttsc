package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestResolveConfigTsgoKeepsAnExplicitlyPinnedCompiler verifies an explicit
// TTSC_TSGO_BINARY still wins over the project's own install.
//
// Anchoring the resolution on the project is a fallback, not a replacement: an
// embedder that pins a compiler (a cross-version harness, a benchmark cell)
// must keep pinning it, and so must the ttsc host that exports the variable
// into every plugin process it spawns. The project here can answer, so the
// assertion pins the precedence rather than the absence of an alternative.
//
//  1. Seed a project holding a resolvable `typescript` install.
//  2. Point TTSC_TSGO_BINARY at a different path.
//  3. Assert the pinned path is returned verbatim.
//
// @evidence contracts/testing.md#behavioral-verification Sets TTSC_TSGO_BINARY with a competing seeded project compiler and asserts bannerResolveConfigTsgo returns exactly the pinned path, not the project compiler.
// @evidence contracts/testing.md#independent-expectations The explicit compiler override outranks discovery. The pinned and project identities are independent paths, and the override is permitted without checking its existence.
// @evidence contracts/testing.md#distinguishing-cases Owns nonempty override precedence against a valid project install; empty-environment discovery and missing artifacts are covered separately.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoKeepsAnExplicitlyPinnedCompiler is selected from test/unit by the root test:go command (`go test ./packages/banner/...`, which excludes the e2e-tagged test/e2e). Runs bannerResolveConfigTsgo in the Go process with testing-restored environment; neither compiler path is executed.
func TestResolveConfigTsgoKeepsAnExplicitlyPinnedCompiler(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.BannerRealpathIfPossible(t.TempDir())
  project := shared.SeedProjectTypeScript(t, root)
  config := filepath.Join(root, "banner.config.ts")
  shared.WriteFile(t, config, "export default { text: \"from ts\" };\n")

  pinned := filepath.Join(root, "pinned", "tsc")
  t.Setenv("TTSC_TSGO_BINARY", pinned)

  got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root))
  if got == project {
    t.Fatalf("resolveConfigTsgo took the project compiler %q over the pinned %q", project, pinned)
  }
  if got != pinned {
    t.Fatalf("resolveConfigTsgo = %q, want the pinned %q", got, pinned)
  }
}
