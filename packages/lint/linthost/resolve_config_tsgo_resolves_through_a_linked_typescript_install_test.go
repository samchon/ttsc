package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall verifies the
// platform package is found beside the install's REAL directory.
//
// pnpm (this repository's own package manager) puts the real `typescript`
// directory in its content-addressed store and leaves a link in the project's
// node_modules. The platform package is a sibling of the store copy, not of the
// link, so a second hop that walked upward from the link path would climb past
// it and resolve nothing. Node resolves a module's dependencies from its real
// location, and this pins that the Go host does the same.
//
//  1. Build a store directory holding `typescript` and its platform package.
//  2. Link the project's `node_modules/typescript` at that store directory.
//  3. Assert the resolution reaches the store's `lib/tsc`.
//
// @evidence contracts/testing.md#behavioral-verification resolveConfigTsgo follows the actual fixture TypeScript directory symlink and locates the platform compiler beside the physical store package instead of the project link.
// @evidence contracts/testing.md#independent-expectations Node resolves package dependencies from the real install location; the authored store layout and seedProjectTypeScript compiler path establish the independent expected executable.
// @evidence contracts/testing.md#distinguishing-cases Owns a symlinked project package whose platform dependency is present only beside its target; missing platform and unlinked project resolution have separate units. Windows junction and actual Windows symlink routes are retained in TestWindowsResolveConfigTsgoThroughLinkedTypeScriptInstall.
// @evidence contracts/testing.md#execution-ownership This selected Go unit invokes resolveConfigTsgo in-process with fixture manifests and an actual symlink, without installing a consumer or launching a host; an unavailable symlink is an explicit environmental limitation, while the mandatory Windows junction case owns the former fallback.
func TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := realpathIfPossible(t.TempDir())
  store := filepath.Join(root, ".store", "typescript@5", "node_modules")
  want := seedProjectTypeScript(t, filepath.Dir(store))

  link := filepath.Join(root, "node_modules", "typescript")
  if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
    t.Fatalf("MkdirAll: %v", err)
  }
  target := filepath.Join(store, "typescript")
  if err := os.Symlink(target, link); err != nil {
    t.Skipf("directory symlink unavailable: %v", err)
  }

  config := filepath.Join(root, "lint.config.ts")
  writeFile(t, config, "export default {};\n")

  if got := resolveConfigTsgo(configToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the linked install's compiler %q", got, want)
  }
}
