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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises this case: Verifies a package glob sees a package installed as a link. The original assertions check assert the operation behind the link is still demanded.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A workspace dependency is a link on every platform a package manager supports: pnpm links by default, and npm and Yarn do the same for a linked package. Enumerating the spelled path with a walker that treats a link as a plain entry finds nothing, so the reference reports an empty population instead of an unresolvable one — and an empty population demands nothing, which reads as full coverage of work that was never checked. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Install the package outside `node_modules` and link it into place. Select it with a glob, exactly as a monorepo consumer does. Assert the operation behind the link is still demanded. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphPackageGlobsFollowALinkedInstall is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRuleAtRoot within the native Go test process. The link fixture calls linkDirectory; on Windows its existing fallback invokes cmd mklink /J, so fixture preparation is not entirely in-process. The rule itself is called directly. The original capability Skipf remains an unresolved supported-platform coverage limitation.
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
    t.Skipf("this platform refuses directory links to unprivileged callers: %v", err)
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
