package evidence

import (
  "strings"
  "testing"
)

const acknowledgementIntentConfig = `{"claims":[{
  "name":"contracts",
  "type":"typescript",
  "files":["src/*.ts"],
  "symbol":"function",
  "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":["h2","h3"]}
}]}`





func assertSingleEvidenceDuplicate(t *testing.T, messages []string, target string) {
  t.Helper()
  if got := countProblemsContaining(messages, "Duplicate @evidence for '"+target+"'"); got != 1 {
    t.Fatalf("same-host duplicate produced %d findings:\n%s", got, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "on the same host at ")
  assertProblemContains(t, messages, "; first declared at ")
  if countProblemsContaining(messages, "Conflicting acknowledgements") != 0 {
    t.Fatalf("same-intent duplicate became a conflict:\n%s", strings.Join(messages, "\n"))
  }
  if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
    t.Fatalf("the duplicate edge stopped covering its target:\n%s", strings.Join(messages, "\n"))
  }
}











func runPrismaAcknowledgementGraph(
  t *testing.T,
  schema string,
  models ...string,
) []string {
  t.Helper()
  inventories := map[string]*artifactInventory{
    "prisma/schema.prisma": {Path: "prisma/schema.prisma", Type: artifactPrisma},
  }
  scan := scanPrismaFile("prisma/schema.prisma", schema, map[string]prismaLocation{})
  hosts := map[string]*evidenceUnit{}
  for _, name := range models {
    for _, unit := range prismaModelUnits(prismaModel{Name: name}) {
      unit.Path = "prisma/schema.prisma"
      hosts[joinPrismaIdentity(unit.Identity)] = unit
    }
  }
  if problems := prismaDeclarationsFromComments(
    scan.Comments,
    hosts,
    prismaInventoriesByDisplay(inventories),
    nil,
  ); len(problems) != 0 {
    t.Fatalf("Prisma declaration scan failed: %v", problems)
  }
  document, documentProblems := scanProjectMarkdown(
    "docs/spec.md",
    "## Contract {#contract}\n",
  )
  if len(documentProblems) != 0 {
    t.Fatalf("Markdown reference scan failed: %v", documentProblems)
  }
  loader := newTypeScriptLoader("", map[string]*artifactInventory{})
  states, problems := materializeClaimStates(
    anchoredGraph("", graphConfig{Claims: []claimSpec{{
      Type:    artifactPrisma,
      Files:   mustGlobSet(t, []string{"prisma/*.prisma"}),
      Symbols: symbolSet{"model": true},
      References: []referenceSpec{{
        Type:    artifactMarkdown,
        Files:   mustGlobSet(t, []string{"docs/spec.md"}),
        Symbols: symbolSet{"h2": true},
      }},
    }}}),
    map[string]*artifactInventory{"docs/spec.md": document},
    inventories,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    loader,
  )
  return problemMessages(append(problems, evaluateEvidenceGraph(states, loader)...))
}
