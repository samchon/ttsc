package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a chain ending on the last hop this rule follows still resolves.
 *
 * The bound counts links followed, not answers given, and the difference is a
 * root that works. A chain whose last link lands on its directory exactly as
 * the last iteration is spent has resolved — the loop simply had none left to
 * look with — and the filesystem follows more than this on every platform. The
 * refusal beside this case is for a chain still going, and reporting one for
 * the other would take a population that loads and fail it. This is the
 * boundary between them, one hop below the case above.
 *
 *  1. Build a chain of exactly the length this rule follows.
 *  2. Root a TypeScript claim at its head and run the rule.
 *  3. Assert the population loads and owes its ordinary acknowledgement.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn accepts exactly thirty-two links and reports the expected uncovered Discounts reference without a resolver refusal.
 * @evidence contracts/testing.md#independent-expectations Literal missing acknowledgement and absence of refused-root wording establish an active population at the limit.
 * @evidence contracts/testing.md#distinguishing-cases The last permitted link settles while the overlong cases reject chains beyond the limit.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkChainEndingOnTheLastFollowedHopResolves(t *testing.T) {
  workspace := t.TempDir()
  project := filepath.Join(workspace, "project")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := project
  head := ""
  for hop := range 32 {
    head = "hop" + decimal(hop)
    link := filepath.Join(workspace, head)
    if err := linkDirectory(t, previous, link); err != nil {
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
