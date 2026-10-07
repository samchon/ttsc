package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestALinkChainEndingOnTheLastFollowedHopResolves verifies a chain ending on the last permitted hop still resolves.
//
// The bound counts followed links, so the thirty-second link may land on a directory.
// Canonical ancestry and relative POSIX targets prevent incidental temporary-root aliases consuming extra native hops.
//
//  1. Build exactly 32 native links onto a real project.
//  2. Require native Stat to establish the reachable fixture and run its rooted claim.
//  3. Assert the ordinary missing acknowledgement and no resolver refusal.
//
// @evidence contracts/testing.md#behavioral-verification runRootedGraphIn accepts exactly thirty-two links and reports the uncovered Discounts reference without root refusal.
// @evidence contracts/testing.md#independent-expectations The literal missing acknowledgement proves active coverage; native Stat independently establishes the fixture is reachable and no unresolved-root message is permitted.
// @evidence contracts/testing.md#distinguishing-cases The final permitted hop lands on a directory; the adjacent modeled resolver table separately rejects the immediately following hop on every host.
// @evidence contracts/testing.md#execution-ownership This named Go unit calls owning graph/resolver operations in-process. Native fixtures use the existing junction boundary on Windows and relative symbolic links elsewhere; creation failures fail preparation. No consumer installation, native build or product host is started.
func TestALinkChainEndingOnTheLastFollowedHopResolves(t *testing.T) {
  workspace := linkedPopulationWorkspace(t)
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  head := ""
  for hop := range 32 {
    head = "hop" + decimal(hop)
    link := filepath.Join(workspace, head)
    if err := linkPopulationDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  declared := "../" + head
  if _, err := os.Stat(filepath.Join(workspace, head)); err != nil {
    t.Fatalf("this platform does not follow a chain this long either (%v)", err)
  }
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
  for _, message := range messages {
    if strings.Contains(message, "found no directory at the end of") {
      t.Fatalf("a chain of exactly the followed length resolves:\n%s", strings.Join(messages, "\n"))
    }
  }
  // The population loaded, so the claim owes what any loaded population owes.
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/pricing.md#discounts'")
}
