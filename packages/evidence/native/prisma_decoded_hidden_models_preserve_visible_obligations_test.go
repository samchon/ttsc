package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies decoded hidden Prisma models retain their cause and visible neighbors.
 *
 * @evidence contracts/testing.md#behavioral-verification Materializes literal Ledger carrying @internal and visible Sale with id columns, parses the original TypeScript persist citation, and runs materializeClaimStates/evaluateEvidenceGraph over the original model/column selector. The hidden Ledger citation must name @internal, Sale must remain owed, and no missing Ledger acknowledgement may appear.
 * @evidence contracts/testing.md#independent-expectations Authored decoded documentation establishes withdrawal; the independent persist citation still names that withdrawn target. Literal hidden-cause and Sale obligation messages follow withdrawal semantics, not a snapshot. No missing Ledger diagnostic follows because a hidden model and its fields do not belong to owed population.
 * @evidence contracts/testing.md#distinguishing-cases Hidden Ledger and visible Sale share one inventory. The same evaluation exercises both refusal of the cited withdrawn target and preservation of the uncited neighbor; blanket suppression or merely removing the hidden lookup would fail. Hidden-column-only and hidden-host comment placement remain complementary cases, while raw Prisma parser admission remains outside this decoded unit.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedHiddenModelsPreserveVisibleObligations is one selectable native Go entry. Actual decoded materializer, TypeScript syntax inventory, claim/reference materialization and graph evaluation run in the native process over literal records/strings. parseTypeScriptInventory uses a tracked temporary filename identity without installing a consumer or starting a parser bridge, Node child, artifact build or product host. The original bridge case remains until actual survivor execution.
 */
func TestPrismaDecodedHiddenModelsPreserveVisibleObligations(t *testing.T) {
  inventory := &artifactInventory{Path: "prisma/schema.prisma", Type: artifactPrisma}
  for _, model := range []prismaModel{
    {Name: "Ledger", Documentation: "@internal Internal bookkeeping.", Fields: []prismaField{{Name: "id", Symbol: "column"}}},
    {Name: "Sale", Fields: []prismaField{{Name: "id", Symbol: "column"}}},
  } {
    for _, unit := range prismaModelUnits(model) {
      unit.Path = inventory.Path
      inventory.Units = append(inventory.Units, unit)
    }
  }
  source := parseTypeScriptInventory(t, "src/providers/sale.ts", `/**
 * @evidence prisma:Ledger Persists the ledger.
 */
export function persist(): void {}
`)
  typescript := map[string]*artifactInventory{"src/providers/sale.ts": source}
  config, configProblems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/providers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"prisma","files":["prisma/schema.prisma"],"symbol":["model","column"]}
  }]}`))
  if len(configProblems) != 0 {
    t.Fatalf("original configuration must decode: %v", configProblems)
  }
  loader := newTypeScriptLoader("", typescript)
  states, problems := materializeClaimStates(anchoredGraph("", config),
    map[string]*artifactInventory{}, map[string]*artifactInventory{"prisma/schema.prisma": inventory},
    map[string]*artifactInventory{}, typescript, loader)
  messages := append(problems, evaluateEvidenceGraph(states, loader)...)
  assertProblemContains(t, messages, "Hidden evidence target 'prisma:Ledger'")
  assertProblemContains(t, messages, "carries '@internal' in its documentation comment")
  assertProblemContains(t, messages, "Missing acknowledgement for 'prisma:Sale'")
  if countProblemsContaining(messages, "Missing acknowledgement for 'prisma:Ledger") != 0 {
    t.Fatalf("a withdrawn model must owe nothing:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
}
