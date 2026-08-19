package driver

import "testing"

// TestTransformDependenciesDropsASelfReportedDependency verifies a file never
// enters its own dependency list.
//
// The file's own text sits outside the completeness contract by construction —
// every consumer compares it before anything else — so a self-edge would only
// make a bundler register the module it is already transforming as one of that
// module's watch inputs.
func TestTransformDependenciesDropsASelfReportedDependency(t *testing.T) {
  declarations := newPluginFileDeclarations()
  declarations.forPlugin(0).addDependency("src/main.ts", "src/main.ts")

  out := aggregateTransformDependencies([]string{"src/main.ts"}, []int{0}, declarations)

  if len(out.Dependencies) != 0 {
    t.Fatalf("expected the self-reported dependency to be dropped, got %v", out.Dependencies)
  }
}
