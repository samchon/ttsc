//go:build windows

package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestWindowsResolveConfigTsgoThroughLinkedTypeScriptInstall verifies Windows
// package links resolve platform dependencies from the physical store.
//
// Junction fallback and actual symbolic links must preserve the same package
// origin; a logical-parent search would miss the compiler beside the store copy.
//
// 1. Seed one TypeScript store with its native-platform package.
// 2. Resolve the compiler through separate symbolic-link and junction projects.
// 3. Require the exact same physical store compiler for both link routes.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo follows a Windows symbolic link and a privilege-free directory junction to the store's TypeScript package, then returns its sibling platform compiler.
// @evidence contracts/testing.md#independent-expectations Node package dependencies belong to their real install location; the authored store and independent seedProjectTypeScript return value establish the expected physical compiler path for both links.
// @evidence contracts/testing.md#distinguishing-cases Owns actual Windows symlink creation when supported and mandatory junction resolution; the symlink subcase retains the original unavailable-link skip while the junction subcase must still run. Missing and unlinked installs remain in portable resolver units.
// @evidence contracts/testing.md#execution-ownership This Windows-constrained Go unit directly invokes the maintained package operation in the owning linthost process over disposable filesystem inputs. Windows supplies aliases and junction fixtures; no installed SDK, source overlay, product build or product host child is required. Fixture-only mklink preparation does not execute the behavior under test.
func TestWindowsResolveConfigTsgoThroughLinkedTypeScriptInstall(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  store := filepath.Join(root, ".store", "typescript@5", "node_modules")
  want := seedProjectTypeScript(t, filepath.Dir(store))
  target := filepath.Join(store, "typescript")
  for _, kind := range []string{"symlink", "junction"} {
    t.Run(kind, func(t *testing.T) {
      project := realpathIfPossible(t.TempDir())
      link := filepath.Join(project, "node_modules", "typescript")
      if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
        t.Fatalf("MkdirAll: %v", err)
      }
      if kind == "symlink" {
        if err := os.Symlink(target, link); err != nil {
          t.Skipf("directory symlink unavailable: %v", err)
        }
      } else if err := createWindowsJunction(link, target); err != nil {
        t.Fatalf("create directory junction: %v", err)
      }
      config := filepath.Join(project, "lint.config.ts")
      writeFile(t, config, "export default {};\n")
      if got := resolveConfigTsgo(configToolAnchors(config, project)); got != want {
        t.Fatalf("resolveConfigTsgo = %q, want the linked install's compiler %q", got, want)
      }
    })
  }
}
