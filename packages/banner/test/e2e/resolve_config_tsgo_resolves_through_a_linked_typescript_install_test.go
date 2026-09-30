package banner_test

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall verifies the
// platform package is found beside the install's REAL directory.
//
// pnpm (this repository's own package manager) puts the real `typescript`
// directory in its content-addressed store and leaves a link in the project's
// node_modules. The platform package is a sibling of the store copy, not of the
// link, so a second hop that walked upward from the link path would climb past
// it and resolve nothing. Node resolves a module's dependencies from its real
// location, and this pins that the Go plugin does the same.
//
//  1. Build a store directory holding `typescript` and its platform package.
//  2. Link the project's `node_modules/typescript` at that store directory.
//  3. Assert the resolution reaches the store's `lib/tsc`.
// @evidence contracts/testing.md#behavioral-verification With tool variables cleared, the banner resolver follows node_modules/typescript into its store install and must locate the sibling platform package compiler file.
// @evidence contracts/testing.md#independent-expectations The authored store topology and binary filename specify the target. The fixture platform pair comes from product code, so platform vocabulary needs its independent unit oracle.
// @evidence contracts/testing.md#distinguishing-cases The platform package is beside the real install, not the link. Symlink or Windows junction fallback is used, and unavailable links skip the case; compiler bytes are never executed.
// @evidence contracts/testing.md#execution-ownership This named entry directly invokes the owning banner resolver over real filesystem fixtures. Empty compiler files and manifests are resolver inputs, not actual consumer installation.
// @evidence contracts/e2e.md#necessary-boundary The resolver consumes a real linked install; when Windows symlink creation is unavailable, windowsjunction.Create invokes the actual native junction command. Portable resolver selection still needs a direct source-unit owner, and these empty compiler bytes do not establish compiler startup.
// @evidence contracts/e2e.md#shared-execution One store/link layout is prepared in t.TempDir without a plugin build or compiler process; only the Windows link fallback can start its necessary junction command.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.Setenv restores tool variables and t.TempDir owns the store, link and empty compiler fixture. Link creation can prevent the assertion from executing.
// @evidence contracts/e2e.md#preserved-coverage The exact linked-store compiler-path assertion remains unchanged. This docs-only change does not prove compiler startup or correct the existing layer placement.
func TestResolveConfigTsgoResolvesThroughALinkedTypeScriptInstall(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := bannerRealpathIfPossible(t.TempDir())
  store := filepath.Join(root, ".store", "typescript@5", "node_modules")
  want := seedProjectTypeScript(t, filepath.Dir(store))

  link := filepath.Join(root, "node_modules", "typescript")
  if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
    t.Fatalf("MkdirAll: %v", err)
  }
  target := filepath.Join(store, "typescript")
  if err := os.Symlink(target, link); err != nil {
    if runtime.GOOS != "windows" || windowsjunction.Create(link, target) != nil {
      t.Skipf("directory link unavailable: %v", err)
    }
  }

  config := filepath.Join(root, "banner.config.ts")
  writeFile(t, config, "export default { text: \"from ts\" };\n")

  if got := bannerResolveConfigTsgo(bannerConfigToolAnchors(config, root)); got != want {
    t.Fatalf("resolveConfigTsgo = %q, want the linked install's compiler %q", got, want)
  }
}
