package evidence

import (
  "encoding/json"
  "github.com/samchon/ttsc/packages/lint/rule"
  "os"
  "path/filepath"
  "testing"
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
 *
 * @evidence contracts/testing.md#behavioral-verification loadPrismaInventories reports one warning when selected warning schema encounters missing Node while error reference matches nothing.
 * @evidence contracts/testing.md#independent-expectations The warning/error declarations and one existing source fix which input owns the failure.
 * @evidence contracts/testing.md#distinguishing-cases An unmatched error reference cannot promote a selected warning-source process failure.
 * @evidence contracts/testing.md#execution-ownership TestPrismaFailureSeverityUsesLoadedSources calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
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
