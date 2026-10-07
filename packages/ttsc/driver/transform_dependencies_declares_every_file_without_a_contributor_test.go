package driver

import (
  "reflect"
  "testing"
)

// TestTransformDependenciesDeclaresEveryFileWithoutAContributor supplies two
// file keys and no contributors directly to the aggregation operation. Both
// keys are declared complete and the dependency map remains nil. This checks
// the empty-contributor rule, not host output, plugin classification, or a
// consumer's decision to stop revalidating a reference closure.
//
// @evidence contracts/testing.md#behavioral-verification aggregateTransformDependencies with no contributors returns both supplied keys as complete and a nil dependency map.
// @evidence contracts/testing.md#independent-expectations The expected complete list and nil dependency map are literals.
// @evidence contracts/testing.md#distinguishing-cases The empty contributor set is the vacuous case, contrasted with the contributor cases in sibling tests.
// @evidence contracts/testing.md#execution-ownership This driver Go unit calls the unexported aggregation with two literal keys and an empty declaration ledger. It uses no filesystem fixture, consumer installation, compiler Program, or product process.
func TestTransformDependenciesDeclaresEveryFileWithoutAContributor(t *testing.T) {
  keys := []string{"src/main.ts", "src/types.ts"}

  out := aggregateTransformDependencies(keys, nil, newPluginFileDeclarations())

  if !reflect.DeepEqual(out.Complete, []string{"src/main.ts", "src/types.ts"}) {
    t.Fatalf("expected every file declared complete, got %v", out.Complete)
  }
  if out.Dependencies != nil {
    t.Fatalf("expected no dependency entries, got %v", out.Dependencies)
  }
}
