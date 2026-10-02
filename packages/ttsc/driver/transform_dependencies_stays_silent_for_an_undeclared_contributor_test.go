package driver

import "testing"

// TestTransformDependenciesStaysSilentForAnUndeclaredContributor verifies that
// a plugin able to change transform output blocks every completeness claim
// until it makes one itself.
//
// This is the compatibility half of the contract: every producer written before
// the declaration existed keeps the host-owned bound exactly, and a plugin whose
// output depends on the type graph cannot have that bound narrowed on its
// behalf.
//
// @evidence contracts/testing.md#behavioral-verification A contributor that never declares leaves the file out of the complete list.
// @evidence contracts/testing.md#independent-expectations An empty complete list is the contract for producers written before the declaration existed.
// @evidence contracts/testing.md#distinguishing-cases The undeclared contributor is the negative neighbor of the declared contributor in sibling tests.
// @evidence contracts/testing.md#execution-ownership TestTransformDependenciesStaysSilentForAnUndeclaredContributor is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
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
