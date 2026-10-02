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
 *
 * @evidence contracts/testing.md#behavioral-verification The test makes the temp `schema` directory unreadable (skipping where permissions cannot be dropped), decodes a Prisma reference rooted at `../schema` over models/**\/*.prisma, and calls configuredPrismaAddressesWithHealth; it requires a problem containing `could not walk Prisma root '../schema':`, zero selected addresses and exactly one failed base.
 * @evidence contracts/testing.md#independent-expectations The expected message text, zero addresses and one failed base are authored from the contract that an unlistable base is reported at its cause and recorded as failed rather than treated as an empty population.
 * @evidence contracts/testing.md#distinguishing-cases One unlistable declared Prisma root; the Markdown walker's identical decision is covered by sibling entries, so this entry owns the Prisma-kind branch.
 * @evidence contracts/testing.md#execution-ownership TestAnUnlistablePrismaRootIsReportedAtItsCause is a Go unit entry in the native test process; it calls the Prisma address collector over a real temp workspace without launching the Prisma bridge, a consumer install or a product host, and skips where permissions cannot be dropped.
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
