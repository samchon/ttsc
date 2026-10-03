package driver

import "testing"

// TestTransformDependenciesDropsASelfReportedDependency supplies one self-edge
// to the declaration ledger and checks that aggregation emits no dependency
// entry. It does not execute a consumer's text comparison or watch registration.
//
// @evidence contracts/testing.md#behavioral-verification A file reported as its own dependency does not appear in the dependency list.
// @evidence contracts/testing.md#independent-expectations The literal zero-entry expectation follows from the side-channel rule that a file's own text is not an additional dependency.
// @evidence contracts/testing.md#distinguishing-cases A self-edge is the only input; other edges are covered by sibling tests.
// @evidence contracts/testing.md#execution-ownership This driver Go unit records one literal self-edge and calls the unexported aggregation in-process. It uses no filesystem fixture, consumer installation, compiler Program, or product process.
func TestTransformDependenciesDropsASelfReportedDependency(t *testing.T) {
  declarations := newPluginFileDeclarations()
  declarations.forPlugin(0).addDependency("src/main.ts", "src/main.ts")

  out := aggregateTransformDependencies([]string{"src/main.ts"}, []int{0}, declarations)

  if len(out.Dependencies) != 0 {
    t.Fatalf("expected the self-reported dependency to be dropped, got %v", out.Dependencies)
  }
}
