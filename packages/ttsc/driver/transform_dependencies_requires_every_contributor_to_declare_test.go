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
// itself stays unlisted (samchon/ttsc#1263).
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
