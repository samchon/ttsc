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
 * a reference then owes. The tagged model also hosts a citation and is cited by
 * one, which exercises both sides through the real parser bridge.
 *
 *  1. Tag one model internal and leave another beside it.
 *  2. Run a TypeScript claim referencing the schema, citing both models.
 *  3. Assert only the untagged model is owed, and the citation of the tagged
 *     one names the tag.
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises the authored fixture. Assert only the untagged model is owed, and the citation of the tagged one names the tag.
 * @evidence contracts/testing.md#independent-expectations A Prisma reference selects its units on a different code path than a TypeScript one, so materializing the tag correctly proves nothing about what a reference then owes. The tagged model also hosts a citation and is cited by one, which exercises both sides through the real parser bridge. The authored scenario requires this outcome: Assert only the untagged model is owed, and the citation of the tagged one names the tag.
 * @evidence contracts/testing.md#distinguishing-cases Tag one model internal and leave another beside it. Run a TypeScript claim referencing the schema, citing both models. Assert only the untagged model is owed, and the citation of the tagged one names the tag.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHiddenModelsLeaveTheGraphPopulation is selected by `go test` in the native package. prismaBridgeRoot and runIndexRuleAtRoot reach the installed Node Prisma parser from the native graph; this is a process boundary case rather than only an inventory unit.
 * @evidence contracts/e2e.md#necessary-boundary The native schema loader calls the installed Node Prisma parser and feeds its model documentation into the graph. A direct prismaModelUnits call cannot detect losing @internal while crossing that parser connection; the graph must refuse the Ledger citation and still owe Sale.
 * @evidence contracts/e2e.md#shared-execution This entry joins the shared native package test process and uses the existing installed parser package and loader. Its workspace fixture comes from prismaBridgeRoot; it creates no installation or native build. Its distinct hidden-model schema requires its own parse input.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot owns a workspace-local fixture with t.Cleanup removal. The schema content determines the loader cache identity, so equivalent results may be reused; this case asserts the delivered graph population and does not require a cold parse. Go process and installed parser ownership remain with the shared runner.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaHiddenModelsLeaveTheGraphPopulation retains its complete schema, claim and original assertions: Ledger is a hidden target, the cause names @internal, Sale stays owed, and Ledger owes no acknowledgement. Direct model withdrawal and host eligibility remain in TestPrismaHidingTagsWithdrawModelsAndColumns and TestPrismaHiddenUnitsHostNothing.
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
