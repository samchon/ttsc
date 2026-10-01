package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a package glob sees a package installed as a link.
 *
 * A workspace dependency is a link on every platform a package manager
 * supports: pnpm links by default, and npm and Yarn do the same for a linked
 * package. Enumerating the spelled path with a walker that treats a link as a
 * plain entry finds nothing, so the reference reports an empty population
 * instead of an unresolvable one — and an empty population demands nothing,
 * which reads as full coverage of work that was never checked.
 *
 *  1. Install the package outside `node_modules` and link it into place.
 *  2. Select it with a glob, exactly as a monorepo consumer does.
 *  3. Assert the operation behind the link is still demanded.
 * @evidence contracts/testing.md#behavioral-verification The test writes a package under packages/api, links it to node_modules/@org/api with a directory symlink, and runIndexRuleAtRoot runs the graph rule with a function claim over src/views/** and a package reference `@org/api` with files `lib/**`; the diagnostics must contain `Missing acknowledgement for 'questions.get'`.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the install contract: a workspace dependency is a link, and a walker that treated the link as a plain entry would report an empty population that demands nothing, so the operation behind the link must still be owed.
 * @evidence contracts/testing.md#distinguishing-cases A package reached only through a symlink with a glob selection; the Windows junction twin is a separate Windows-only entry, and an unavailable symlink fails the fixture rather than skipping.
 * @evidence contracts/testing.md#execution-ownership TestGraphPackageGlobsFollowALinkedInstall is a Go unit entry in the native test process; it writes real temp files, creates a real directory symlink and calls the graph rule through runIndexRuleAtRoot, with no consumer install or product host, and fails (not skips) if the link cannot be created, as an unprivileged Windows run may.
 */
func TestGraphPackageGlobsFollowALinkedInstall(t *testing.T) {
  root := t.TempDir()
  store := filepath.Join(root, "packages", "api")
  if err := os.MkdirAll(filepath.Join(store, "lib"), 0o755); err != nil {
    t.Fatal(err)
  }
  for name, content := range map[string]string{
    "package.json":           packageManifest,
    "lib/index.d.ts":         "export * as questions from \"./questions/get.js\";\n",
    "lib/questions/get.d.ts": "export declare function get(): void;\n",
  } {
    absolute := filepath.Join(store, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  linked := filepath.Join(root, "node_modules", "@org", "api")
  if err := os.MkdirAll(filepath.Dir(linked), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := linkDirectory(store, linked); err != nil {
    t.Fatalf("the symbolic-link fixture could not be created: %v", err)
  }
  assertProblemContains(t, runIndexRuleAtRoot(t, root, map[string]string{
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/**"],"symbol":"function"}
  }]}`), "Missing acknowledgement for 'questions.get'")
}
