package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies the Prisma walker answers an unlistable root the same way.
 *
 * Both walkers held the same guard and the same dead handler, so repairing one
 * would decide an identical filesystem state by artifact kind. The Prisma half
 * runs through its address collector, because the bridge below it needs a linked
 * feature suite this question does not depend on.
 *
 *  1. Root a Prisma population at a directory the process may not list.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the root is named once and the base is recorded failed.
 * @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth is exercised with the scenario below; the assertions require the root is named once and the base is recorded failed.
 * @evidence contracts/testing.md#independent-expectations Both walkers held the same guard and the same dead handler, so repairing one would decide an identical filesystem state by artifact kind. The Prisma half runs through its address collector, because the bridge below it needs a linked feature suite this question does not depend on.
 * @evidence contracts/testing.md#distinguishing-cases Root a Prisma population at a directory the process may not list. Collect the configured addresses and their health. Assert the root is named once and the base is recorded failed.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistablePrismaRootIsReportedAtItsCause is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAnUnlistablePrismaRootIsReportedAtItsCause(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  schema := filepath.Join(workspace, "schema")
  if err := os.MkdirAll(schema, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, schema)
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "root":"../schema",
      "files":["models/**/*.prisma"],
      "symbol":"model"
    }
  }]}`)
  addresses, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertProblemContains(t, problems, "could not walk Prisma root '../schema':")
  if len(addresses) != 0 {
    t.Fatalf("a base that could not be listed selected %d addresses", len(addresses))
  }
  if len(failed) != 1 {
    t.Fatalf("a base that could not be listed is recorded failed, got %d", len(failed))
  }
}
