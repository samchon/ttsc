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
 * The portable symbolic-link case cannot exercise that Windows kernel identity.
 *
 * 1. Write the same authored package outside node_modules and create a real junction at its package name.
 * 2. Select lib/** through the package reference and evaluate the actual graph rule.
 * 3. Require the original questions.get missing-acknowledgement diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises the package resolver, TypeScript export traversal and graph coverage after a real Windows junction is created. Missing acknowledgement for questions.get distinguishes following the link from silently accepting an empty population.
 * @evidence contracts/testing.md#independent-expectations The authored entry reexports questions from its get declaration. The literal questions.get diagnostic follows that public namespace address and the uncited function; it is not computed from resolver output.
 * @evidence contracts/testing.md#distinguishing-cases The original outside-store package, namespace reexport, lib glob and uncited operation all remain. TestGraphPackageGlobsFollowALinkedInstall owns the portable symbolic-link twin; this entry changes only the link's actual Windows junction mechanism.
 * @evidence contracts/testing.md#execution-ownership TestGraphPackageGlobsFollowAWindowsJunction is the one named Windows Go boundary entry in this file. The repository runner selects it only in the Windows kernel population, using the already installed candidate SDK with the native graph rule and fixture helpers in one Go process.
 * @evidence contracts/e2e.md#necessary-boundary linkWindowsPopulationDirectory starts the actual Windows cmd builtin to create an NTFS junction, then the graph's filesystem walker and package resolver must traverse it. An authored inventory or a portable symbolic link cannot establish that this Windows connection materializes the package's operations.
 * @evidence contracts/e2e.md#shared-execution The existing Windows kernel batch shares one installed CLI consumer, its candidate source SDK and one Go test process. This case performs no install or native plugin build. Its short cmd lifetime creates the one junction fixture and exits before graph evaluation; no repeated product host is used for portable rule semantics.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns a fresh store, package path and junction for this entry. The fixture helper joins cmd before the rule reads the filesystem, and t.TempDir cleanup removes the case on normal completion or failure. Package bytes and glob inputs match the portable case; no global parser or resolver cache is reset.
 * @evidence contracts/e2e.md#preserved-coverage This Windows entry retains the original package manifest, declaration files, lib glob, uncited consumer and exact questions.get assertion. The portable unit entry retains the same assertion with an in-process symbolic link and fails unsupported fixture preparation instead of skipping it.
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
