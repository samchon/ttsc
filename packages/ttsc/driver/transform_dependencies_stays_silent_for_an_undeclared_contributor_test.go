package driver

import "testing"

// TestTransformDependenciesStaysSilentForAnUndeclaredContributor verifies that
// a plugin able to change transform output blocks every completeness claim
// until it makes one itself.
//
// This is the compatibility half of the contract: every producer written before
// the declaration existed keeps the host-owned bound exactly, and a plugin whose
// output depends on the type graph cannot have that bound narrowed on its
// behalf (samchon/ttsc#1263).
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
