package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies the Prisma walker follows a linked root the same way.
 *
 * Both walkers lstat their root through the same call, so repairing one would
 * decide an identical filesystem state by artifact kind. The Prisma half runs
 * through its address collector, because the bridge below it needs a linked
 * feature suite this question does not depend on.
 *
 *  1. Put a schema behind a link and root a Prisma population at the link.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the schema is found and addressed through the declared root.
 *
 * @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth walks the linked schema root and returns one healthy address through ../documents.
 * @evidence contracts/testing.md#independent-expectations One fixture schema and its literal relative spelling determine count and address without normalizing any Prisma schema.
 * @evidence contracts/testing.md#distinguishing-cases Address discovery tests filesystem walking only; it never invokes the installed Prisma parser.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedPrismaRootCollectsItsSchemas(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  if err := os.MkdirAll(root, 0o755); err != nil {
    t.Fatal(err)
  }
  writeLinkedDocuments(t, workspace, map[string]string{
    "models/user.prisma": "model User {\n  id Int @id\n}\n",
  })
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"prisma",
      "root":"../documents",
      "files":["models/**/*.prisma"],
      "symbol":"model"
    }
  }]}`)
  addresses, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertNoProblems(t, problems)
  if len(failed) != 0 {
    t.Fatalf("a linked root that resolves is healthy, got %d failed", len(failed))
  }
  if len(addresses) != 1 {
    t.Fatalf("the schema behind the link is selected, got %d", len(addresses))
  }
  if addresses[0].Display != "../documents/models/user.prisma" {
    t.Fatalf("address = %q, want it spelled through the declared root", addresses[0].Display)
  }
}
