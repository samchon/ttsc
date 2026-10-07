package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a TypeScript population on the default base is not refused for a
 * chain.
 *
 * The gate asks the resolver question of a declared root only. A Program spells
 * its sources against the directory ttsc was invoked with, so the comparison
 * matches without any resolution, and refusing there failed every claim on the
 * base nearly every project uses. Measured before the guard: one refusal and no
 * obligations, over a graph that otherwise reports the one it owes.
 *
 * The configuration declares no Markdown or Prisma population on purpose, so no
 * walker can produce the refusal and the assertion is about this gate alone.
 *
 *  1. Drive the rule with a project root that is a chain longer than the
 *     resolver follows. Both entry points realpath the root before the rule sees
 *     it, so production reaches this shape only through a chain the platform
 *     itself refuses; the case builds the state directly instead.
 *  2. Declare only TypeScript populations, so no walker can produce the refusal.
 *  3. Assert the real obligation is reported and no refusal is.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot keeps the implicit TypeScript base usable through an overlong link chain and reports the missing ISpec acknowledgement.
 * @evidence contracts/testing.md#independent-expectations Original literal ISpec diagnostic and absence of root-refusal wording distinguish active coverage from silent deactivation.
 * @evidence contracts/testing.md#distinguishing-cases No explicit root property is configured; the declared-root refusal is covered by the adjacent project-root case.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestADefaultTypeScriptBaseIsNotRefusedForAChain(t *testing.T) {
  workspace := t.TempDir()
  real := filepath.Join(workspace, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  previous := real
  for hop := range 34 {
    link := filepath.Join(workspace, "hop"+decimal(hop))
    if err := linkDirectory(t, previous, link); err != nil {
      t.Fatalf("this platform refused to create a link: %v", err)
    }
    previous = link
  }
  if _, err := os.Stat(previous); err != nil {
    t.Fatalf(
      "this platform did not follow the chain to a directory either (%v), so nothing reaches the gate",
      err,
    )
  }
  messages := runIndexRuleAtRoot(t, previous, map[string]string{
    "src/sale.ts": "export interface ISale {}\n",
    "src/spec.ts": "export interface ISpec {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/sale.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/spec.ts"],"symbol":"type"}
  }]}`)
  if len(messages) == 0 {
    logLinkedPopulationPaths(t, previous)
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'ISpec'")
  if countProblemsContaining(messages, "found no directory at the end of") != 0 {
    t.Fatalf(
      "the base a Program spells its sources against owes no resolution:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
