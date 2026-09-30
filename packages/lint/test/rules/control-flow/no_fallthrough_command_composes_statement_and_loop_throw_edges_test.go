package linthost

import "testing"

// TestNoFallthroughCommandComposesStatementAndLoopThrowEdges verifies throw
// reachability respects statement order, branch joins, and loop execution
// boundaries. Syntactically present expressions must not open catch paths when
// return or a constant-false test makes them unreachable.
//
// 1. Pair reachable calls and conditions with unreachable statement twins.
// 2. Exercise loop entry/update boundaries and empty-switch discriminants.
// 3. Assert only reachable throwable nodes let the empty catch fall through.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check matches exactly every authored diagnostic marker for statement and loop exception edges.
// @evidence contracts/testing.md#independent-expectations Authored call/reference conditions are first-throwable nodes only when reached; statement order and literal-false loop tests independently cut off later nodes.
// @evidence contracts/testing.md#distinguishing-cases Calls before/after return, false/unknown loops, do-while test, for initializer/update and empty-switch discriminants retain their original paired outcomes.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCommandComposesStatementAndLoopThrowEdges is selected in the shared Go unit population and invokes assertNoFallthroughCommandMarkers and run(check) with the actual Program. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughCommandComposesStatementAndLoopThrowEdges(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `declare const condition: boolean;
declare function call(): number;

function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        call();
        return;
      } catch {}
    case 1: // diagnostic
      break;
    case 2:
      try {
        return;
        call();
      } catch {}
    case 3:
      break;
    case 4:
      try {
        if (condition) {
          return;
        } else {
          return;
        }
      } catch {}
    case 5: // diagnostic
      break;
    case 6:
      try {
        while (false) {
          call();
        }
        return;
      } catch {}
    case 7:
      break;
    case 8:
      try {
        while (condition) {
          return;
        }
        return;
      } catch {}
    case 9: // diagnostic
      break;
    case 10:
      try {
        do {
          return;
        } while (call());
      } catch {}
    case 11:
      break;
    case 12:
      try {
        for (; false; call()) {}
        return;
      } catch {}
    case 13:
      break;
    case 14:
      try {
        for (call(); ; ) {
          return;
        }
      } catch {}
    case 15: // diagnostic
      break;
    case 16:
      try {
        switch (condition) {}
        return;
      } catch {}
    case 17: // diagnostic
      break;
    case 18:
      try {
        switch (0) {}
        return;
      } catch {}
    case 19:
      break;
  }
}

inspect(0);
`)
}
