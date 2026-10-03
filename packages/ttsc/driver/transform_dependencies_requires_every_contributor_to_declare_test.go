package driver

import (
  "reflect"
  "testing"
)

// TestTransformDependenciesRequiresEveryContributorToDeclare verifies the
// aggregation rule over a composed plugin set: a file is complete only when
// every contributing plugin declared it, because a consumer cannot attribute
// one plugin's reported inputs back to it.
//
// It also pins that reporting and declaring are separate acts: a plugin's
// dependency list widens what consumers invalidate on even while the file
// itself stays unlisted.
//
// @evidence contracts/testing.md#behavioral-verification A file is complete only when every contributing plugin declared it, and a plugin's reported dependencies widen the list even while the file stays unlisted.
// @evidence contracts/testing.md#independent-expectations The expected complete and dependency lists are literals for one declaring and one silent contributor.
// @evidence contracts/testing.md#distinguishing-cases One declaring plugin alone and then both declaring contrast, so the silent contributor blocks the claim.
// @evidence contracts/testing.md#execution-ownership TestTransformDependenciesRequiresEveryContributorToDeclare is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestTransformDependenciesRequiresEveryContributorToDeclare(t *testing.T) {
  declarations := newPluginFileDeclarations()
  first := declarations.forPlugin(0)
  first.addDependency("src/main.ts", "src/consulted.d.ts")
  first.addComplete("src/main.ts")
  keys := []string{"src/main.ts"}

  partial := aggregateTransformDependencies(keys, []int{0, 1}, declarations)

  if len(partial.Complete) != 0 {
    t.Fatalf("expected the silent contributor to block the claim, got %v", partial.Complete)
  }
  if !reflect.DeepEqual(partial.Dependencies["src/main.ts"], []string{"src/consulted.d.ts"}) {
    t.Fatalf("expected the reported dependency to survive, got %v", partial.Dependencies)
  }

  declarations.forPlugin(1).completeEveryFile()
  full := aggregateTransformDependencies(keys, []int{0, 1}, declarations)

  if !reflect.DeepEqual(full.Complete, []string{"src/main.ts"}) {
    t.Fatalf("expected both contributors to complete the claim, got %v", full.Complete)
  }
}
