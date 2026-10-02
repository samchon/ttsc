//go:build e2e

package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a withdrawn Prisma model leaves the graph's population, not only the
 * materializer's.
 *
 * A Prisma reference selects its units on a different code path than a
 * TypeScript one, so materializing the tag correctly proves nothing about what
 * a reference then owes. The tagged model is also cited from TypeScript, so the
 * case covers what the reference owes and what a citation of a withdrawn model
 * is told, through the real parser bridge.
 *
 *  1. Tag one model internal and leave another beside it.
 *  2. Run a TypeScript claim referencing the schema, citing the tagged model.
 *  3. Assert only the untagged model is owed, and the citation of the tagged
 *     one names the tag.
 * @evidence contracts/testing.md#behavioral-verification A schema with `/// @internal` Ledger and an untagged Sale, plus a TypeScript function citing prisma:Ledger, is run with a typescript claim referencing the schema's models and columns. The report must contain "Hidden evidence target 'prisma:Ledger'" with "carries '@internal' in its documentation comment", "Missing acknowledgement for 'prisma:Sale'", and no "Missing acknowledgement for 'prisma:Ledger" message.
 * @evidence contracts/testing.md#independent-expectations Expected messages are literal fragments authored from the rule: hidden units are withdrawn from what a reference owes and a citation of one is refused with its cause; they are not copied from a prior output.
 * @evidence contracts/testing.md#distinguishing-cases A hidden model versus a visible model in one schema, from both sides (the hidden one is cited; the visible one is owed). Hidden columns (a model's hidden fields) and a hidden column on a visible model are not run here; TestPrismaHidingTagsWithdrawModelsAndColumns and TestPrismaHiddenUnitsHostNothing own those.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHiddenModelsLeaveTheGraphPopulation is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot (project rule plus loadPrismaInventories; Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. A direct prismaModelUnits call cannot show that the tag survives that crossing.
 * @evidence contracts/e2e.md#shared-execution This entry joins the shared native package test process and uses the existing installed parser package and loader. Its workspace fixture comes from prismaBridgeRoot; it creates no installation or native build. Its distinct hidden-model schema requires its own parse input.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot owns a workspace-local fixture with t.Cleanup removal. The schema content determines the loader cache identity, so equivalent results may be reused; this case asserts the delivered graph population and does not require a cold parse. Go process and installed parser ownership remain with the shared runner.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts the hidden-target diagnostic and its @internal cause, Sale still owed, and Ledger owing nothing. Direct withdrawal and host-eligibility cases are in TestPrismaHidingTagsWithdrawModelsAndColumns and TestPrismaHiddenUnitsHostNothing.
 */
func TestPrismaHiddenModelsLeaveTheGraphPopulation(t *testing.T) {
  root := prismaBridgeRoot(t, nil)
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "prisma/schema.prisma": `datasource db {
  provider = "sqlite"
}

/// @internal Internal bookkeeping.
model Ledger {
  id Int @id
}

model Sale {
  id Int @id
}
`,
    "src/providers/sale.ts": `/**
 * @evidence prisma:Ledger Persists the ledger.
 */
export function persist(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/providers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"prisma","files":["prisma/schema.prisma"],"symbol":["model","column"]}
  }]}`)
  assertProblemContains(t, messages, "Hidden evidence target 'prisma:Ledger'")
  assertProblemContains(t, messages, "carries '@internal' in its documentation comment")
  assertProblemContains(t, messages, "Missing acknowledgement for 'prisma:Sale'")
  if countProblemsContaining(messages, "Missing acknowledgement for 'prisma:Ledger") != 0 {
    t.Fatalf(
      "a withdrawn model must owe nothing:\n%s",
      strings.Join(messages, "\n"),
    )
  }
}
