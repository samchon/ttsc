package linthost

import (
  "path/filepath"
  "testing"
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
// @evidence contracts/testing.md#behavioral-verification nodePackageManifestFrom resolves two relative config-anchor spellings to the same absolute sibling package manifest and leaves an absent package unresolved.
// @evidence contracts/testing.md#independent-expectations Node resolves module search ancestry from the absolute anchor; the known authored manifest location and fictional absent package supply independent hit and miss oracles.
// @evidence contracts/testing.md#distinguishing-cases Owns local and two-parent relative anchors plus an absent scoped package; nested-node_modules decoy precedence is checked by the companion test.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored temporary manifest ancestry and scoped working directory reach nodePackageManifestFrom directly in-process; two absolute hits and an absent-package miss observe search without package-manager installation or Node execution.
func TestNodePackageManifestFromResolvesARelativeAnchor(t *testing.T) {
  root := realpathIfPossible(t.TempDir())
  want := filepath.Join(root, "node_modules", "sibling", "package.json")
  writeFile(t, want, `{"name":"sibling"}`)
  nested := filepath.Join(root, "project", "nested")
  writeFile(t, filepath.Join(nested, "lint.config.ts"), "export default {};\n")
  t.Chdir(nested)

  got := nodePackageManifestFrom("lint.config.ts", "sibling")
  if got != want {
    t.Fatalf("nodePackageManifestFrom = %q, want the install above the cwd %q", got, want)
  }
  // The second witness. `../../lint.config.ts` is the case where the walk over
  // the unresolved string does stumble onto the install, and answers with a
  // relative path — which the loader then hands to a child running under
  // `--cwd <ephemeral loader dir>`, where it resolves against the wrong
  // directory instead of failing loudly.
  if got := nodePackageManifestFrom(filepath.Join("..", "..", "lint.config.ts"), "sibling"); got != want {
    t.Fatalf("nodePackageManifestFrom = %q, want the absolute manifest %q", got, want)
  }
  // The negative twin: resolving the ancestry is not the same as inventing it.
  // A package absent from the authored fixture remains unresolved while the walk is
  // longer. The scoped fictional name reduces accidental ambient matches; it
  // does not isolate ancestors outside the temp fixture.
  if got := nodePackageManifestFrom("lint.config.ts", "@ttsc/fixture-package-that-is-never-installed"); got != "" {
    t.Fatalf("nodePackageManifestFrom resolved an absent package to %q", got)
  }
}
