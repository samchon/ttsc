package linthost

import "testing"

// TestNoFallthroughCommandComposesNestedTryFinally verifies nested catches
// consume only reachable throws and finally preserves or overrides every
// completion category. A finalizer after a closed infinite path is itself
// unreachable and must not invent an exception edge.
//
// 1. Nest return and throw paths through catches and ordinary finalizers.
// 2. Exercise finalizers, a non-completing try, and catch binding evaluation.
// 3. Assert only throws that escape the nested construct reach the outer catch.
func TestNoFallthroughCommandComposesNestedTryFinally(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `declare const identifier: number;
declare function call(): void;
declare function fallback(): number;

function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        try {
          return;
        } catch {}
      } catch {}
    case 1:
      break;
    case 2:
      try {
        try {
          throw 0;
        } catch {
          return;
        }
      } catch {}
    case 3:
      break;
    case 4:
      try {
        try {
          return identifier;
        } catch {
          return;
        }
      } catch {}
    case 5:
      break;
    case 6:
      try {
        try {
          return;
        } finally {}
      } catch {}
    case 7:
      break;
    case 8:
      try {
        try {
          return;
        } finally {
          identifier;
        }
      } catch {}
    case 9: // diagnostic
      break;
    case 10:
      try {
        try {
          return identifier;
        } finally {
          return;
        }
      } catch {}
    case 11:
      break;
    case 12:
      try {
        try {
          throw 0;
        } finally {}
      } catch {}
    case 13: // diagnostic
      break;
    case 14:
      try {
        try {
          while (true) {}
        } finally {
          call();
        }
      } catch {}
    case 15:
      break;
    case 16:
      try {
        try {
          throw {};
        } catch ({ value = fallback() }) {
          return;
        }
      } catch {}
    case 17: // diagnostic
      break;
    case 18:
      try {
        try {
          throw 0;
        } catch (error) {
          return;
        }
      } catch {}
    case 19:
      break;
  }
}

inspect(0);
`)
}
