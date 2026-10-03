package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestResolveConfigTsgoFallsBackToTheProjectRootAnchor verifies a config whose
// own ancestry answers nothing still resolves through the resolution root.
//
// The other direction of the anchor order. A config named by the tsconfig
// entry's `configFile` can live outside the project tree entirely — a shared
// preset package, a checkout-wide config directory — so its upward walk reaches
// no node_modules at all. The resolution root is the second anchor precisely
// for that shape; without it the fix would only cover configs that sit inside
// the project.
//
//  1. Seed a project whose install sits at the root only.
//  2. Put the config in a sibling tree the project does not contain.
//  3. Assert the root's compiler is still resolved.
//
// @evidence contracts/testing.md#behavioral-verification With tool variables cleared, calls bannerResolveConfigTsgo over an uninstalled shared-config anchor and an installed project-root anchor; the root compiler path must win.
// @evidence contracts/testing.md#independent-expectations The config and project install occupy separate fixture subtrees. The expected executable is independently placed in the npm layout before resolver lookup.
// @evidence contracts/testing.md#distinguishing-cases Owns second-anchor fallback after an empty first lookup. requireNoAmbientInstall may skip polluted TypeScript ancestry; config-first precedence has a separate case.
// @evidence contracts/testing.md#execution-ownership Unit entry TestResolveConfigTsgoFallsBackToTheProjectRootAnchor is selected from test/unit by the root test:go command (`go test ./packages/banner/...`). Runs bannerResolveConfigTsgo, bannerConfigToolAnchors and manifest/stat lookup in the Go process; the seeded empty compiler file is never launched.
func TestResolveConfigTsgoFallsBackToTheProjectRootAnchor(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  base := shared.BannerRealpathIfPossible(t.TempDir())
  requireNoAmbientInstall(t, base, "typescript")
  root := filepath.Join(base, "project")
  want := shared.SeedProjectTypeScript(t, root)
  config := filepath.Join(base, "shared", "banner.config.ts")
  shared.WriteFile(t, config, "export default { text: \"from ts\" };\n")

  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the project root compiler %q", got, want)
  }
}
