package driver

import (
  "reflect"
  "testing"
)

// TestTransformDependenciesRequiresEveryContributorToDeclare verifies the
// aggregation rule for two supplied contributor indexes: one per-file claim
// leaves the file incomplete, while the second contributor's all-file claim
// admits the literal key to the complete list.
//
// It also pins that reporting and declaring are separate acts: a plugin's
// dependency remains in the aggregate even while the file stays unlisted as
// complete. Consumer invalidation and plugin classification are not exercised.
//
// @evidence contracts/testing.md#behavioral-verification With two supplied contributors, the aggregate preserves the reported dependency while one contributor is silent, then lists the file complete after that contributor declares every file complete.
// @evidence contracts/testing.md#independent-expectations The partial dependency and final completeness expectations are literal lists for the two authored contributor states; the final dependency list is not separately asserted.
// @evidence contracts/testing.md#distinguishing-cases One declaring plugin alone and then both declaring contrast, so the silent contributor blocks the claim.
// @evidence contracts/testing.md#execution-ownership This driver Go unit mutates its own declaration ledger and calls aggregation directly. It uses no filesystem fixture, compiler Program, consumer installation, or child process.
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
