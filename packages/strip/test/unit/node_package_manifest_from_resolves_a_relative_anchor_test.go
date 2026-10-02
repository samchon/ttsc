package strip_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestNodePackageManifestFromResolvesARelativeAnchor verifies a relatively
// named config file still reaches the installs above it.
//
// Node derives its search paths from the resolved anchor, so a relative
// specifier walks the real ancestry. Walking the relative string instead ends
// at "." after one step: the first candidate is read against the process
// directory and the second never happens, so a project whose node_modules sits
// anywhere above the working directory answers nothing at all and the loader
// silently falls back to a bare `ttsx` and no `--binary`. The same walk feeds
// both resolutions, so one missed hop costs the launcher and the compiler.
//
//  1. Install a package under the temp root and work from a nested directory.
//  2. Resolve from a config named relative to that working directory, then
//     from one whose own relative walk would have reached the install.
//  3. Assert both answer the install above, at an absolute path a child
//     process with its own cwd can still use.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripNodePackageManifestFrom from a nested cwd with bare and ../../ config anchors; both must return the absolute sibling manifest, while an absent scoped package returns empty.
// @evidence contracts/testing.md#independent-expectations The fixture places sibling/package.json only at the root node_modules. Node-style lookup starts from the absolute anchor, so both relative spellings have that independently seeded destination.
// @evidence contracts/testing.md#distinguishing-cases Owns bare and parent-relative anchors plus an absent package; the node_modules-directory decoy is covered separately.
// @evidence contracts/testing.md#execution-ownership Unit entry TestNodePackageManifestFromResolvesARelativeAnchor is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. Runs stripNodePackageManifestFrom and native path/stat operations in the Go process. t.Chdir is restored by testing; no fixture package is imported.
func TestNodePackageManifestFromResolvesARelativeAnchor(t *testing.T) {
  root := shared.StripRealpathIfPossible(t.TempDir())
  want := filepath.Join(root, "node_modules", "sibling", "package.json")
  shared.WriteFile(t, want, `{"name":"sibling"}`)
  nested := filepath.Join(root, "project", "nested")
  shared.WriteFile(t, filepath.Join(nested, "strip.config.ts"), "export default {};\n")
  t.Chdir(nested)

  got := stripNodePackageManifestFrom("strip.config.ts", "sibling")
  if got != want {
    t.Fatalf("stripNodePackageManifestFrom = %q, want the install above the cwd %q", got, want)
  }
  // The second witness. `../../strip.config.ts` is the case where the walk over
  // the unresolved string does stumble onto the install, and answers with a
  // relative path — which the loader then hands to a child running under
  // `--cwd <ephemeral loader dir>`, where it resolves against the wrong
  // directory instead of failing loudly.
  if got := stripNodePackageManifestFrom(filepath.Join("..", "..", "strip.config.ts"), "sibling"); got != want {
    t.Fatalf("stripNodePackageManifestFrom = %q, want the absolute manifest %q", got, want)
  }
  // The negative twin: resolving the ancestry is not the same as inventing it.
  // A package nothing installed stays unresolved even now that the walk is
  // longer. The name is scoped and fictional so no ambient install above the
  // temp dir can answer for it.
  if got := stripNodePackageManifestFrom("strip.config.ts", "@ttsc/fixture-package-that-is-never-installed"); got != "" {
    t.Fatalf("stripNodePackageManifestFrom resolved an absent package to %q", got)
  }
}
