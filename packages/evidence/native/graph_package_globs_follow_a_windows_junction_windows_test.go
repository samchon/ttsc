//go:build windows

package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a package reference glob reaches exported operations through a Windows junction.
 *
 * Windows workspace dependencies use junctions without requiring symbolic-link
 * privileges. A walker that treats the junction as a plain entry can produce a
 * healthy empty population and silently omit the package's exported operation.
 * This case names the junction explicitly, so the identity stays pinned even if the shared link helper changes.
 *
 * 1. Write the same authored package outside node_modules and create a real junction at its package name.
 * 2. Select lib/** through the package reference and evaluate the actual graph rule.
 * 3. Require the original questions.get missing-acknowledgement diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises the package resolver, TypeScript export traversal and graph coverage after a real Windows junction is created. Missing acknowledgement for questions.get distinguishes following the link from silently accepting an empty population.
 * @evidence contracts/testing.md#independent-expectations The authored entry reexports questions from its get declaration. The literal questions.get diagnostic follows that public namespace address and the uncited function; it is not computed from resolver output.
 * @evidence contracts/testing.md#distinguishing-cases The original outside-store package, namespace reexport, lib glob and uncited operation all remain. TestGraphPackageGlobsFollowALinkedInstall owns the portable symbolic-link twin; this entry changes only the link's actual Windows junction mechanism.
 * @evidence contracts/testing.md#execution-ownership TestGraphPackageGlobsFollowAWindowsJunction is a Windows-only Go unit entry of package evidence, run by go test on a Windows host. It creates real NTFS directory junctions through linkWindowsPopulationDirectory and drives the rule in-process; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestGraphPackageGlobsFollowAWindowsJunction(t *testing.T) {
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
  if err := linkWindowsPopulationDirectory(store, linked); err != nil {
    t.Fatalf("the Windows junction fixture could not be created: %v", err)
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
