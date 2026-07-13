package linthost

import "testing"

// TestNoFallthroughCommandTracksReturnExceptionEdges verifies that a return
// reaches catch only when evaluating its operand contains an ESLint throwable
// node. Bare and literal returns terminate; references, members, calls, and
// constructions can transfer to a normally completing catch.
//
// 1. Place each return shape in a try followed by an empty catch.
// 2. Pair non-throwing returns with every first-throwable expression family.
// 3. Assert only catches reachable during operand evaluation fall through.
func TestNoFallthroughCommandTracksReturnExceptionEdges(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `declare const identifier: number;
declare const holder: { value: number };
declare function call(): number;
declare class Box {}

function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        return;
      } catch {}
    case 1:
      break;
    case 2:
      try {
        return 1;
      } catch {}
    case 3:
      break;
    case 4:
      try {
        return "literal";
      } catch {}
    case 5:
      break;
    case 6:
      try {
        return identifier;
      } catch {}
    case 7: // diagnostic
      break;
    case 8:
      try {
        return holder.value;
      } catch {}
    case 9: // diagnostic
      break;
    case 10:
      try {
        return call();
      } catch {}
    case 11: // diagnostic
      break;
    case 12:
      try {
        return new Box();
      } catch {}
    case 13: // diagnostic
      break;
    case 14:
      try {
        throw 0;
      } catch {}
    case 15: // diagnostic
      break;
  }
}

inspect(0);
`)
}
