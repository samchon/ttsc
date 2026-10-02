package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a real Prisma walk failure under a declared root ascends through it.
 *
 * The acceptance for this repair names both base shapes on both walkers, and the
 * two axes are decided in different places: the artifact kind picks the
 * membership question, and the base shape picks the composition. Only this
 * combination leaves the shared function reached through the Prisma callback
 * with a base that ascends.
 *
 *  1. Root a Prisma population above the project.
 *  2. Make a directory inside it unreadable and collect the addresses.
 *  3. Assert the failure is spelled through the declared root.
 *
 * @evidence contracts/testing.md#behavioral-verification The test makes schema/models/private (a sibling of the project directory) unreadable, skipping where permissions cannot be dropped, decodes a Prisma reference with root `../schema` and files models/**\/*.prisma, and calls configuredPrismaAddressesWithHealth; it requires a problem containing `could not inspect '../schema/models/private':` and exactly one failed base.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the authored root-relative path that a reader can open from the project directory; the failed-base count follows from the one declared population.
 * @evidence contracts/testing.md#distinguishing-cases The base ascends out of the project, which is the case where a project-relative composition would print the wrong path; the non-ascending Prisma case is owned by the sibling project-relative entry.
 * @evidence contracts/testing.md#execution-ownership TestARealPrismaWalkFailureUnderADeclaredRootAscendsThroughIt is a Go unit entry in the native test process; it calls the Prisma address collector directly over a real temp workspace without the Prisma bridge, a consumer install or a product host, and skips where permissions cannot be dropped.
 */
func TestARealPrismaWalkFailureUnderADeclaredRootAscendsThroughIt(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  private := filepath.Join(workspace, "schema", "models", "private")
  for _, directory := range []string{root, private} {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  if err := os.WriteFile(
    filepath.Join(private, "hidden.prisma"),
    []byte("model Hidden {}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
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
  _, failed, problems := configuredPrismaAddressesWithHealth(config)
  assertProblemContains(
    t,
    problems,
    "could not inspect '../schema/models/private':",
  )
  if len(failed) != 1 {
    t.Fatalf("a walk failure records its base failed, got %d", len(failed))
  }
}
