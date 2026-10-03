package linthost

import "testing"

// TestNoFallthroughCommandPreservesCodePathBoundaries verifies nested
// functions, class fields, and static blocks do not leak return or throw paths
// into the enclosing try. Immediately evaluated class heritage, computed
// names, and generic instantiation expressions remain part of the enclosing
// path, as do abrupt resumptions of a yield in the current generator.
//
// 1. Put identifier reads inside the authored separately owned function/class paths.
// 2. Pair them with runtime generic/class expressions, async, and generator paths.
// 3. Assert only immediately evaluated references make catches reachable.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check matches all authored diagnostic markers across function, class, async and generator paths.
// @evidence contracts/testing.md#independent-expectations Supported CodePath ownership isolates nested functions, field initializers and static blocks; immediate heritage/computed names and yield resumptions retain outer edges. This is a lint compatibility oracle, not proof of real runtime non-throwing.
// @evidence contracts/testing.md#distinguishing-cases Original deferred/immediate reference twins and generator finalizer paths retain their opposite marker outcomes.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughCommandPreservesCodePathBoundaries is selected in the shared Go unit population and invokes assertNoFallthroughCommandMarkers and run(check) with the actual Program. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughCommandPreservesCodePathBoundaries(t *testing.T) {
  assertNoFallthroughCommandMarkers(t, `declare const identifier: number;
declare const key: string;
declare class Base {}
declare function generic<T>(): T;
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
        type Alias = Shape;
        interface LocalShape extends Shape {}
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
    case 10:
      try {
        const instantiated = generic<number>;
        return;
      } catch {}
    case 11: // diagnostic
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
