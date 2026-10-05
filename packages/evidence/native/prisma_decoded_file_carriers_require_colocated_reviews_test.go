package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies a decoded Prisma file carrier accepts only its own exclusion review.
 *
 * @evidence contracts/testing.md#behavioral-verification Scans the original Sale model, unattached .schema exclusion and fixed Pricing document, attaches comments/reviews to literal decoded model units, and runs actual materializeClaimStates/evaluateEvidenceGraph. Bare and wrong-model reviews leave the file exclusion unreviewed; a co-located review closes it.
 * @evidence contracts/testing.md#independent-expectations File carriers match review identity by their source position rather than the unrelated model host. The fingerprint is obtained from the maintained diagnostic exactly as in the original case and cannot independently certify hashing. Literal host/declaration/reference counts prevent an empty graph from satisfying the clean assertion.
 * @evidence contracts/testing.md#distinguishing-cases The same model/document/configuration drives bare, wrong-host and co-located review states. The ledger remains an unattached .schema carrier in all three, preserving the declaration-side fallback boundary. Parser admission and transport of the decoded model belong to the separate source/consumer survivors.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedFileCarriersRequireColocatedReviews is a selectable Go unit entry. Its three sequential states call native comment/Markdown scanners, decoded unit construction and policy evaluation in-process on authored strings. No filesystem fixture, Node parser bridge, artifact build, installation or product host is needed; original bridge assertions remain pending actual survivor execution.
 */
func TestPrismaDecodedFileCarriersRequireColocatedReviews(t *testing.T) {
  const raw = `{"claims":[{"type":"prisma","files":["prisma/**/*.prisma","prisma/exclude.schema"],"symbol":"model","reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2","requireReview":true}}]}`
  const document = "## Pricing\n\nThe rate is capped at 30%.\n"
  const model = "model Sale {\n  id String @id\n}\n"
  const bareLedger = "/// @evidenceExclude docs/spec.md#pricing The schema stores no pricing policy.\n\n"
  run := func(schema string, ledger string) graphDiagnostics {
    inventories := map[string]*artifactInventory{
      "prisma/schema.prisma":  {Path: "prisma/schema.prisma", Type: artifactPrisma},
      "prisma/exclude.schema": {Path: "prisma/exclude.schema", Type: artifactPrisma},
    }
    hosts := map[string]*evidenceUnit{}
    for _, unit := range prismaModelUnits(prismaModel{Name: "Sale", Fields: []prismaField{{Name: "id", Symbol: "column"}}}) {
      unit.Path = "prisma/schema.prisma"
      inventories[unit.Path].Units = append(inventories[unit.Path].Units, unit)
      hosts[joinPrismaIdentity(unit.Identity)] = unit
    }
    for path, content := range map[string]string{"prisma/schema.prisma": schema, "prisma/exclude.schema": ledger} {
      scan := scanPrismaFile(path, content, map[string]prismaLocation{})
      assertNoProblems(t, prismaDeclarationsFromComments(scan.Comments, hosts, prismaInventoriesByDisplay(inventories), nil))
    }
    config, configProblems := decodeGraphConfig(json.RawMessage(raw))
    assertNoProblems(t, configProblems)
    markdown, _ := scanProjectMarkdown("docs/spec.md", document)
    loader := newTypeScriptLoader("", map[string]*artifactInventory{})
    states, problems := materializeClaimStates(anchoredGraph("", config),
      map[string]*artifactInventory{"docs/spec.md": markdown}, inventories,
      map[string]*artifactInventory{}, map[string]*artifactInventory{}, loader)
    if len(states) != 1 || len(states[0].Hosts) != 1 || len(states[0].Declarations) != 1 ||
      len(states[0].References) != 1 || len(states[0].References[0].Units) != 1 {
      t.Fatalf("each state must retain one model, exclusion and selected section: %#v", states)
    }
    return append(problems, evaluateEvidenceGraph(states, loader)...)
  }
  unreviewed := run(model, bareLedger)
  assertProblemContains(t, unreviewed, "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
  fingerprint := ""
  for _, message := range problemMessages(unreviewed) {
    if asksForAFingerprint(message) {
      fingerprint = shapedFingerprint(message)
      if fingerprint != "" {
        break
      }
    }
  }
  if fingerprint == "" {
    t.Fatalf("the missing-review diagnostic must name its token: %v", unreviewed)
  }
  wrongHost := "/// @evidenceExcludeReview docs/spec.md#pricing #" + fingerprint + " Read the section from the wrong host.\n" + model
  assertProblemContains(t, run(wrongHost, bareLedger), "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
  reviewedLedger := "/// @evidenceExclude docs/spec.md#pricing The schema stores no pricing policy.\n" +
    "/// @evidenceExcludeReview docs/spec.md#pricing #" + fingerprint + " Read the section: it names no stored model.\n\n"
  assertNoProblems(t, run(model, reviewedLedger))
}
