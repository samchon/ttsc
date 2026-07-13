package linthost

import "testing"

// TestNoFallthroughCommandTracksBindingReferenceEdges verifies object binding
// identifiers retain ESLint's reference edge while plain array and rest
// bindings do not. The source values contain no other throwable node, so each
// transition isolates the binding classifier through the real check command.
//
// 1. Exercise shorthand and aliased object bindings.
// 2. Pair them with array/rest bindings and for-of assignment patterns.
// 3. Assert only the object property reads make the catch reachable.
func TestNoFallthroughCommandTracksBindingReferenceEdges(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        const { property } = { property: 1 };
        return;
      } catch {}
    case 1: // diagnostic
      break;
    case 2:
      try {
        const { property: local } = { property: 1 };
        return;
      } catch {}
    case 3: // diagnostic
      break;
    case 4:
      try {
        const [element] = [1];
        return;
      } catch {}
    case 5:
      break;
    case 6:
      try {
        const { ...rest } = { property: 1 };
        return;
      } catch {}
    case 7:
      break;
    case 8:
      try {
        let target = 0;
        for ([target] of [[1]]) {}
        return;
      } catch {}
    case 9:
      break;
    case 10:
      try {
        let target = 0;
        for ({ property: target } of [{ property: 1 }]) {}
        return;
      } catch {}
    case 11: // diagnostic
      break;
  }
}

inspect(0);
`)
}
