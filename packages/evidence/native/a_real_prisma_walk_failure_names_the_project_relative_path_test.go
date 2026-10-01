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
 * @evidence contracts/testing.md#behavioral-verification The test makes prisma/private unreadable (skipping where permissions cannot be dropped), decodes a TypeScript claim with a Prisma reference over prisma/**\/*.prisma, and calls configuredPrismaAddressesWithHealth; it requires problems containing `could not inspect 'prisma/private':` and `configured Prisma sources can be indexed`, and exactly one failed base.
 * @evidence contracts/testing.md#independent-expectations The expected path spelling and the repair clause are authored literals, and the failed-base count of one follows from the single declared population whose walk failed; none is taken from the walker's own output.
 * @evidence contracts/testing.md#distinguishing-cases One unreadable directory under one declared Prisma population, so the walk failure must be recorded as a failed base rather than an empty population. The Prisma bridge and a root above the project are not exercised here; the latter belongs to a sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestARealPrismaWalkFailureNamesTheProjectRelativePath is a Go unit entry in the native test process; it calls the Prisma address collector directly over a real temp directory without launching the Prisma bridge, a consumer install or a product host, and skips where permissions cannot be dropped.
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
