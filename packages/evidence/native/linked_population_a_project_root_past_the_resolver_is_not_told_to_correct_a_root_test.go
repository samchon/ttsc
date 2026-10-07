package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestAProjectRootPastTheResolverIsNotToldToCorrectARoot verifies an overlong project root names the invocation, not a property.
//
// A project identity declares no root property.
// Native validation may reject it before the Markdown walker reaches the bounded resolution policy; either result must avoid inventing a configuration repair.
//
//  1. Build an overlong native chain as the project identity.
//  2. Run the real project gate if native Stat refuses, otherwise run the authored Markdown-reference graph.
//  3. Assert the exact project-identity failure or the bounded invocation repair, without a root-property repair.
//
// @evidence contracts/testing.md#behavioral-verification graphRule.Check rejects a native-inaccessible project identity; for a native-readable chain runIndexRuleAtRoot requires the bounded project-root refusal and invocation repair without a root-property instruction.
// @evidence contracts/testing.md#independent-expectations Actual native Stat chooses the reachable graph path. Exact authored project-gate, project-root and invocation literals identify the respective failures, and the bounded path forbids Correct-the-root wording.
// @evidence contracts/testing.md#distinguishing-cases The same 34-link project identity exercises the real native prerequisite when inaccessible and the default Markdown-base bound when readable; declared roots are covered separately.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestAProjectRootPastTheResolverIsNotToldToCorrectARoot(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`
  if _, err := os.Stat(previous); err != nil {
    assertUnreachableLinkedProject(t, previous, config)
    return
  }
  messages := runIndexRuleAtRoot(t, previous, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
    "src/sale.ts":     "export interface ISale {}\n",
  }, config)
  if len(messages) == 0 {
    logLinkedPopulationPaths(t, previous)
  }
  assertProblemContains(t, messages, "found no directory at the end of the ttsc project root")
  assertProblemContains(t, messages, "Run ttsc against the directory those links end at.")
  if countProblemsContaining(messages, "Correct the 'root' property") != 0 {
    t.Fatalf(
      "the base that declared no root has no property to correct:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
