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
 *
 * @evidence contracts/testing.md#behavioral-verification A schema with `/// @internal` Ledger and an untagged Sale, plus a TypeScript function citing prisma:Ledger, is run with a typescript claim referencing the schema's models and columns. The report must contain "Hidden evidence target 'prisma:Ledger'" with "carries '@internal' in its documentation comment", "Missing acknowledgement for 'prisma:Sale'", and no "Missing acknowledgement for 'prisma:Ledger" message.
 * @evidence contracts/testing.md#independent-expectations Expected messages are literal fragments authored from the rule: hidden units are withdrawn from what a reference owes and a citation of one is refused with its cause; they are not copied from a prior output.
 * @evidence contracts/testing.md#distinguishing-cases A hidden model versus a visible model in one schema, from both sides (the hidden one is cited; the visible one is owed). Hidden columns (a model's hidden fields) and a hidden column on a visible model are not run here; TestPrismaHidingTagsWithdrawModelsAndColumns and TestPrismaHiddenUnitsHostNothing own those.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHiddenModelsLeaveTheGraphPopulation is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
