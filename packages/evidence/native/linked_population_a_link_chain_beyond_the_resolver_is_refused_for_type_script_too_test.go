package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// TestALinkChainBeyondTheResolverIsRefusedForTypeScriptToo verifies an overlong declared TypeScript root is refused.
//
// TypeScript populations use Program sources without walking the root, but their declared root still needs a usable physical identity.
// Native traversal may fail before the rule bound.
//
//  1. Build a real project behind 35 native links.
//  2. Run the graph with that head as the declared TypeScript root.
//  3. Assert the root and the refusal owned by the actual native capability.
//
// @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports the declared typescript root instead of allowing silent population deactivation.
// @evidence contracts/testing.md#independent-expectations Authored root and chain literals pin the rule refusal when native Stat succeeds; native Stat and its underlying error independently pin the earlier refusal otherwise.
// @evidence contracts/testing.md#distinguishing-cases The TypeScript kind walks no directory; thirty-five links exceed the separately pinned thirty-two-link policy.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestALinkChainBeyondTheResolverIsRefusedForTypeScriptToo(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  head := filepath.Join(workspace, "mirror")
  if err := linkPopulationDirectory(t, previous, head); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"../mirror",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertLinkedPopulationRefusal(t, messages, head, "typescript", "../mirror")
}
