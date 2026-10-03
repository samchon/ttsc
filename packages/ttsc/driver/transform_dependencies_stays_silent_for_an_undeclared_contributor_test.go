package driver

import "testing"

// TestTransformDependenciesStaysSilentForAnUndeclaredContributor verifies that
// one supplied contributor index without a declaration leaves the supplied
// file key out of the complete list. It exercises the conservative aggregation
// rule, not historical producer behavior, plugin classification, or a consumer's
// invalidation bound.
//
// @evidence contracts/testing.md#behavioral-verification A contributor that never declares leaves the file out of the complete list.
// @evidence contracts/testing.md#independent-expectations The literal zero-length expectation follows from requiring an explicit completeness declaration from the supplied contributor.
// @evidence contracts/testing.md#distinguishing-cases The undeclared contributor is the negative neighbor of the declared contributor in sibling tests.
// @evidence contracts/testing.md#execution-ownership This driver Go unit calls aggregation with literal inputs and its own empty ledger. It uses no filesystem fixture, compiler Program, consumer installation, or child process.
func TestTransformDependenciesStaysSilentForAnUndeclaredContributor(t *testing.T) {
  out := aggregateTransformDependencies(
    []string{"src/main.ts"},
    []int{0},
    newPluginFileDeclarations(),
  )

  if len(out.Complete) != 0 {
    t.Fatalf("expected no completeness declaration, got %v", out.Complete)
  }
}
