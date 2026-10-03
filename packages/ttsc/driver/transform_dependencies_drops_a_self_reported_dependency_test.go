package driver

import "testing"

// TestTransformDependenciesDropsASelfReportedDependency verifies a file never
// enters its own dependency list.
//
// The file's own text sits outside the completeness contract by construction —
// every consumer compares it before anything else — so a self-edge would only
// make a bundler register the module it is already transforming as one of that
// module's watch inputs.
//
// @evidence contracts/testing.md#behavioral-verification A file reported as its own dependency does not appear in the dependency list.
// @evidence contracts/testing.md#independent-expectations The expected empty dependency map follows from the contract that a file's own text is compared first.
// @evidence contracts/testing.md#distinguishing-cases A self-edge is the only input; other edges are covered by sibling tests.
// @evidence contracts/testing.md#execution-ownership TestTransformDependenciesDropsASelfReportedDependency is a Go unit test inside the driver package: it calls the unexported operation in-process with literal inputs or a temporary directory, installing no consumer and starting no product process.
func TestTransformDependenciesDropsASelfReportedDependency(t *testing.T) {
  declarations := newPluginFileDeclarations()
  declarations.forPlugin(0).addDependency("src/main.ts", "src/main.ts")

  out := aggregateTransformDependencies([]string{"src/main.ts"}, []int{0}, declarations)

  if len(out.Dependencies) != 0 {
    t.Fatalf("expected the self-reported dependency to be dropped, got %v", out.Dependencies)
  }
}
