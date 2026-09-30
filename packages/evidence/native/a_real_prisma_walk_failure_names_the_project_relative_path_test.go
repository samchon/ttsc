package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a real Prisma walk failure answers exactly as the Markdown one does.
 *
 * The two walkers were the same decision written twice, and repairing one while
 * leaving the other reinstates by artifact kind the branch asymmetry #1236
 * removed. The Prisma half is exercised through its address collector rather
 * than the whole rule, because the Prisma bridge needs a linked feature suite
 * that this question does not depend on.
 *
 *  1. Make a directory inside a Prisma population unreadable.
 *  2. Collect the configured addresses and their health.
 *  3. Assert the failure is project-relative and the base is recorded failed.
 * @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth is exercised with the scenario below; the assertions require the failure is project-relative and the base is recorded failed.
 * @evidence contracts/testing.md#independent-expectations The two walkers were the same decision written twice, and repairing one while leaving the other reinstates by artifact kind the branch asymmetry #1236 removed. The Prisma half is exercised through its address collector rather than the whole rule, because the Prisma bridge needs a linked feature suite that this question does not depend on.
 * @evidence contracts/testing.md#distinguishing-cases Make a directory inside a Prisma population unreadable. Collect the configured addresses and their health. Assert the failure is project-relative and the base is recorded failed.
 * @evidence contracts/testing.md#execution-ownership TestARealPrismaWalkFailureNamesTheProjectRelativePath is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestARealPrismaWalkFailureNamesTheProjectRelativePath(t *testing.T) {
  root := t.TempDir()
  private := filepath.Join(root, "prisma", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.prisma"), []byte("model Hidden {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
  }]}`)
  _, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertProblemContains(t, problems, "could not inspect 'prisma/private':")
  assertProblemContains(t, problems, "configured Prisma sources can be indexed")
  if len(failed) != 1 {
    t.Fatalf("a walk failure records its base failed, got %d", len(failed))
  }
}
