package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingChainsBlocksInsideLoopBodies retains captures across nested loop-body blocks.
//
// An enclosing loop dependency independently pins captured bindings while capture-free nested blocks remain movable.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual binding analysis follows retained while/do and nested-loop block boundaries.
// @evidence contracts/testing.md#independent-expectations An enclosing loop dependency independently pins captured bindings while capture-free nested blocks remain movable.
// @evidence contracts/testing.md#distinguishing-cases Free while/do cases report while nested loop captures stay clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingChainsBlocksInsideLoopBodies owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingChainsBlocksInsideLoopBodies(t *testing.T) {
  // Loop bodies live in IterationStatementBase.Statement, so the loop-body
  // chain must not rely on Node.Body(). Upstream reports definitions at the
  // top of while/do bodies yet keeps ones whose captures live anywhere on
  // the block chain inside the loop body.
  source := `declare const condition: boolean;
declare function consume(value: unknown): void;
while (condition) {
  const movableWhile = (): boolean => true;
  consume(movableWhile);
}
do {
  const movableDo = (): boolean => true;
  consume(movableDo);
} while (condition);
function outer(): void {
  for (;;) {
    const pinned = 1;
    {
      {
        const capturesLoopBody = (): number => pinned;
        consume(capturesLoopBody);
      }
    }
  }
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 2 ||
    findings[0].Message != "Move arrow function 'movableWhile' to the outer scope." ||
    findings[1].Message != "Move arrow function 'movableDo' to the outer scope." {
    t.Fatalf("loop body chain mismatch: %+v", findings)
  }
}
