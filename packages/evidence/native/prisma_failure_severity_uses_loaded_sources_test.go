package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies a Prisma loader failure belongs only to populations in its input set.
 *
 * An unmatched error reference supplies no schema to the parser. It must not
 * promote a failure from a separate warning reference that did supply a file.
 *
 * 1. Select one schema at warning level and an absent schema at error level.
 * 2. Make the shared parser unavailable.
 * 3. Assert its failure remains a warning.
 */
func TestPrismaFailureSeverityUsesLoadedSources(t *testing.T) {
  previous := prismaSchemas
  prismaSchemas = newPrismaCache()
  t.Cleanup(func() { prismaSchemas = previous })
  root := t.TempDir()
  if err := os.WriteFile(filepath.Join(root, "schema.prisma"), []byte("model Item {\n  id Int @id\n}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{"type":"typescript","files":["src/**"],"reference":[
    {"type":"prisma","files":["schema.prisma"],"severity":"warning"},
    {"type":"prisma","files":["absent.prisma"],"severity":"error"}
  ]}]}`))
  assertNoProblems(t, problems)
  resolveGraphSeverities(&config, rule.SeverityError)
  resolveGraphBases(root, &config)
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(root, "missing-node"))
  _, findings := loadPrismaInventories(root, config)
  if len(findings) != 1 || findings[0].Severity != rule.SeverityWarn {
    t.Fatalf("unmatched reference promoted loader failure: %#v", findings)
  }
}
