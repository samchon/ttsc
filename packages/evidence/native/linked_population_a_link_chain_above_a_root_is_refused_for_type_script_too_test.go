package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// TestALinkChainAboveARootIsRefusedForTypeScriptToo verifies an overlong ancestor of a TypeScript root is refused.
//
// The leaf is an ordinary directory; the unresolved chain is in its ancestry.
// Native Stat may refuse before the rule can apply its separate link limit.
//
//  1. Build a canonical workspace and a 34-link ancestor with a real project leaf.
//  2. Run the actual graph against that declared TypeScript root.
//  3. Assert native error preservation or bounded-chain refusal according to independent Stat.
//
// @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports the typescript root refusal instead of silently deactivating the claim, including a chain above its leaf.
// @evidence contracts/testing.md#independent-expectations The authored root label and chain wording identify the bounded branch; independent native Stat and its underlying error text identify an earlier native refusal.
// @evidence contracts/testing.md#distinguishing-cases A directory leaf behind an overlong ancestor distinguishes whole-path resolution from leaf-only inspection; the native-success branch also requires passes-through wording.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestALinkChainAboveARootIsRefusedForTypeScriptToo(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := workspace
  head := ""
  for hop := range 34 {
    head = "hop" + decimal(hop)
    link := filepath.Join(workspace, head)
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  declared := "../" + head + "/project"
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/docs/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":     "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "root":"`+declared+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertLinkedPopulationRefusal(t, messages, filepath.Join(workspace, head, "project"), "typescript", declared)
  // The sentence was written for a chain at the root and reports one above it
  // too, so it says the path passes through a chain rather than that it is one.
  if _, err := os.Stat(filepath.Join(workspace, head, "project")); err == nil {
    assertProblemContains(t, messages, "passes through a chain of links longer than this rule follows")
  }
}
