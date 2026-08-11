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
  // A package nothing installed stays unresolved even now that the walk is
  // longer. The name is scoped and fictional so no ambient install above the
  // temp dir can answer for it.
  if got := nodePackageManifestFrom("lint.config.ts", "@ttsc/fixture-package-that-is-never-installed"); got != "" {
    t.Fatalf("nodePackageManifestFrom resolved an absent package to %q", got)
  }
}
