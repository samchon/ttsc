package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestALinkChainBeyondTheResolverIsReportedNotWalked verifies an unreachable Markdown link population is reported, not empty.
//
// A native filesystem may reject a long chain before the rule can apply its own bound.
// Both failures must name the root and suppress derivative empty-population diagnostics.
//
//  1. Place a real Markdown obligation behind 35 native links.
//  2. Run the graph with that declared reference root.
//  3. Assert the capability-appropriate refusal and absence of matched-no-files diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification runRootedGraphIn refuses the Markdown root and suppresses the derivative matched-no-markdown-files diagnostic.
// @evidence contracts/testing.md#independent-expectations Native Stat independently chooses the reachable branch and supplies the native error; authored root and chain literals identify bounded refusal rather than emptiness.
// @evidence contracts/testing.md#distinguishing-cases The endpoint contains a real document, contrasting a failed population with a healthy empty set; both native-gate and rule-bound refusals retain the same health assertion.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestALinkChainBeyondTheResolverIsReportedNotWalked(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  target := filepath.Join(workspace, "target")
  if err := os.MkdirAll(filepath.Join(target, "requirements"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(target, "requirements", "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  previous := target
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  documents := filepath.Join(workspace, "documents")
  if err := linkPopulationDirectory(t, previous, documents); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/src/sale.ts": "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertLinkedPopulationRefusal(t, messages, documents, "markdown", "../documents")
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf(
      "a root the walk never reached is a failed population, not an empty one:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
