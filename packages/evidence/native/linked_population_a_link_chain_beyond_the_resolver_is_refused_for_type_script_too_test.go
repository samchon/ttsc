package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a chain past the resolver is refused for the kind that walks nothing.
 *
 * The two walkers refuse it because the directory they were about to walk is
 * still a link. This kind has no walk, so its gate has to ask, and until it did
 * the population came back empty and the claim deactivated in silence, over the
 * same root a Markdown reference beside it reported.
 *
 *  1. Build a chain longer than the resolver follows onto the project.
 *  2. Root a TypeScript claim at its head and run the rule.
 *  3. Assert the root is refused rather than selecting nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports the bounded TypeScript root refusal for a chain the host can stat.
 * @evidence contracts/testing.md#independent-expectations The literal typescript root ../mirror refusal is an authored failure oracle.
 * @evidence contracts/testing.md#distinguishing-cases Thirty-five links exceed the thirty-two-link resolver limit; the exact boundary is separately pinned by TestTheResolverFollowsExactlyItsBoundOfLinks.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkChainBeyondTheResolverIsRefusedForTypeScriptToo(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  head := filepath.Join(workspace, "mirror")
  if err := linkDirectory(t, previous, head); err != nil {
    t.Fatalf("this platform refused to create a link: %v", err)
  }
  if _, err := os.Stat(head); err != nil {
    t.Fatalf(
      "this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
      err,
    )
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
  assertProblemContains(
    t,
    messages,
    "found no directory at the end of the typescript root '../mirror'",
  )
}
