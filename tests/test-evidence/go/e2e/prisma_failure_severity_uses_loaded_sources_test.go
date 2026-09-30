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
 * @evidence contracts/testing.md#execution-ownership TestPrismaFailureSeverityUsesLoadedSources is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_failure_severity_uses_loaded_sources_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadPrismaInventories reports one warning when selected warning schema encounters missing Node while error reference matches nothing. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaFailureSeverityUsesLoadedSources retains its original function body, local inputs and every assertion after transfer. loadPrismaInventories reports one warning when selected warning schema encounters missing Node while error reference matches nothing. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
