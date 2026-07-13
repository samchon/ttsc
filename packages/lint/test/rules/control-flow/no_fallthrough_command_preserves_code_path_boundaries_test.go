package linthost

import "testing"

// TestNoFallthroughCommandPreservesCodePathBoundaries verifies nested
// functions, class fields, and static blocks do not leak return or throw paths
// into the enclosing try. Immediately evaluated class heritage and computed
// names remain part of the enclosing path, as do the abrupt resumptions of a
// yield expression in the current generator.
//
// 1. Put identifier reads inside every deferred function/class execution path.
// 2. Pair them with class heritage, computed names, async, and generator paths.
// 3. Assert only immediately evaluated references make catches reachable.
func TestNoFallthroughCommandPreservesCodePathBoundaries(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `declare const identifier: number;
declare const key: string;
declare class Base {}
interface Shape {}

function inspect(value: number): unknown {
  switch (value) {
    case 0:
      try {
        return () => identifier;
      } catch {}
    case 1:
      break;
    case 2:
      try {
        return function nested() {
          return identifier;
        };
      } catch {}
    case 3:
      break;
    case 4:
      try {
        const typedOnly: Shape | null = null;
        class Nested implements Shape {
          field = identifier;
          method(): number {
            return identifier;
          }
          static {
            identifier;
          }
        }
        return;
      } catch {}
    case 5:
      break;
    case 6:
      try {
        return class extends Base {};
      } catch {}
    case 7: // diagnostic
      break;
    case 8:
      try {
        class Computed {
          [key](): void {}
        }
        return;
      } catch {}
    case 9: // diagnostic
      break;
  }
}

async function inspectAsync(value: number): Promise<unknown> {
  switch (value) {
    case 0:
      try {
        return async () => identifier;
      } catch {}
    case 1:
      break;
    case 2:
      try {
        return await identifier;
      } catch {}
    case 3: // diagnostic
      break;
  }
}

function* inspectGenerator(value: number): Generator<number, unknown, unknown> {
  switch (value) {
    case 0:
      try {
        return yield 1;
      } catch {}
    case 1: // diagnostic
      break;
    case 2:
      try {
        return yield identifier;
      } catch {}
    case 3: // diagnostic
      break;
    case 4:
      try {
        try {
          yield 1;
          while (true) {}
        } catch {
          while (true) {}
        } finally {
          identifier;
        }
      } catch {}
    case 5: // diagnostic
      break;
  }
}

inspect(0);
void inspectAsync(0);
inspectGenerator(0);
`)
}
