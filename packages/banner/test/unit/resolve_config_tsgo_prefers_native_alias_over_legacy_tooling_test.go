package banner_test

import (
  "os"
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
)

// TestResolveConfigTsgoPrefersNativeAliasOverLegacyTooling verifies native
// config evaluation selects the alias beside a JavaScript compiler.
//
// 1. Seed distinct ordinary and alias-owned platform executables.
// 2. Resolve the alias beside TypeScript 6.
// 3. Reject ambiguous or incorrectly named native aliases, then legacy-only input.
//
// @evidence contracts/testing.md#behavioral-verification Calls the maintained config compiler resolver with cleared tool overrides; distinct platform paths expose alias selection, and legacy-only rejection prevents borrowing a native platform package from a JavaScript compiler.
// @evidence contracts/testing.md#independent-expectations The authored alias owns its nested platform binary while the ordinary install reports 6.0.2; its independent renamed path is the expected selection.
// @evidence contracts/testing.md#distinguishing-cases Coexisting legacy and native installs select the alias; a second distinct native alias and an incorrect installed package identity are rejected. Removing the alias returns no compiler despite an ordinary platform executable. Existing tests retain normal install, missing platform and explicit override cases.
// @evidence contracts/testing.md#execution-ownership This Go unit uses temporary manifests and empty executables and calls the actual resolver in-process through the existing shared linkname bridge; it builds no consumer and runs no compiler.
func TestResolveConfigTsgoPrefersNativeAliasOverLegacyTooling(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.BannerRealpathIfPossible(t.TempDir())
  original := shared.SeedProjectTypeScript(t, root)
  modules := filepath.Join(root, "node_modules")
  alias := filepath.Join(modules, "@compiler", "current")
  shared.WriteFile(t, filepath.Join(root, "package.json"), `{"devDependencies":{"@compiler/current":"npm:typescript@7.0.2"}}`)
  sourcePlatform := filepath.Dir(filepath.Dir(original))
  targetPlatform := filepath.Join(alias, "node_modules", "@typescript", filepath.Base(sourcePlatform))
  if err := os.MkdirAll(filepath.Dir(targetPlatform), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Rename(sourcePlatform, targetPlatform); err != nil {
    t.Fatal(err)
  }
  shared.SeedProjectTypeScript(t, root)
  manifest := filepath.Join(alias, "package.json")
  shared.WriteFile(t, manifest, `{"name":"typescript","version":"7.0.2"}`)
  shared.WriteFile(t, filepath.Join(modules, "typescript", "package.json"), `{"name":"@typescript/typescript6","version":"6.0.2"}`)
  want := filepath.Join(targetPlatform, "lib", filepath.Base(original))
  config := filepath.Join(root, "banner.config.ts")
  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root)); got != want {
    t.Fatalf("alias compiler = %q, want %q", got, want)
  }
  shared.WriteFile(t, filepath.Join(modules, "another-compiler", "package.json"), `{"name":"typescript","version":"7.0.2"}`)
  shared.WriteFile(t, filepath.Join(root, "package.json"), `{"dependencies":{"another-compiler":"npm:typescript@7"},"devDependencies":{"@compiler/current":"npm:typescript@7"}}`)
  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root)); got != "" {
    t.Fatalf("ambiguous compiler = %q, want no selection", got)
  }
  shared.WriteFile(t, filepath.Join(root, "package.json"), `{"devDependencies":{"@compiler/current":"npm:typescript@7"}}`)
  shared.WriteFile(t, manifest, `{"name":"another-package","version":"7.0.2"}`)
  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root)); got != "" {
    t.Fatalf("incorrect package identity = %q, want no native compiler", got)
  }
  if err := os.Remove(manifest); err != nil {
    t.Fatal(err)
  }
  if got := shared.BannerResolveConfigTsgo(shared.BannerConfigToolAnchors(config, root)); got != "" {
    t.Fatalf("legacy-only compiler = %q, want no native compiler", got)
  }
}
