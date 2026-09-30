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
 * @evidence contracts/testing.md#behavioral-verification configuredPrismaAddressesWithHealth is exercised with the scenario below; the assertions require the failure is spelled through the declared root.
 * @evidence contracts/testing.md#independent-expectations The acceptance for this repair names both base shapes on both walkers, and the two axes are decided in different places: the artifact kind picks the membership question, and the base shape picks the composition. Only this combination leaves the shared function reached through the Prisma callback with a base that ascends.
 * @evidence contracts/testing.md#distinguishing-cases Root a Prisma population above the project. Make a directory inside it unreadable and collect the addresses. Assert the failure is spelled through the declared root.
 * @evidence contracts/testing.md#execution-ownership TestARealPrismaWalkFailureUnderADeclaredRootAscendsThroughIt is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
