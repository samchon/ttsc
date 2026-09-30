package evidence

import (
  "testing"
)

/**
 * Verifies a withdrawn Prisma unit hosts nothing.
 *
 * Host eligibility is what decides whether a declaration may carry `@evidence`
 * at all, and an empty host set is also what stops it from being an exclusion
 * carrier. Both follow from the same answer, so it is pinned directly.
 *
 *  1. Ask for the host kinds of a withdrawn unit and of an ordinary one.
 *  2. Assert the withdrawn unit offers none.
 *  3. Assert the ordinary unit still offers its own symbol.
 * @evidence contracts/testing.md#behavioral-verification prismaHostSymbols exercises the authored fixture. Assert the ordinary unit still offers its own symbol.
 * @evidence contracts/testing.md#independent-expectations Host eligibility is what decides whether a declaration may carry `@evidence` at all, and an empty host set is also what stops it from being an exclusion carrier. Both follow from the same answer, so it is pinned directly. The authored scenario requires this outcome: Assert the ordinary unit still offers its own symbol.
 * @evidence contracts/testing.md#distinguishing-cases Ask for the host kinds of a withdrawn unit and of an ordinary one. Assert the withdrawn unit offers none. Assert the ordinary unit still offers its own symbol.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHiddenUnitsHostNothing runs as a Go unit entry in the native package. prismaHostSymbols executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestPrismaHiddenUnitsHostNothing(t *testing.T) {
  if symbols := prismaHostSymbols(&evidenceUnit{
    Symbol: "model",
    Hidden: "@internal",
  }); len(symbols) != 0 {
    t.Fatalf("a withdrawn Prisma unit must host nothing, got %v", symbols)
  }
  if symbols := prismaHostSymbols(&evidenceUnit{Symbol: "model"}); !symbols["model"] {
    t.Fatalf("an ordinary model must host a model citation, got %v", symbols)
  }
}
