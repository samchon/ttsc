package linthost

import "testing"

// TestUnicornNoUnusedPropertiesReferenceIdentity verifies checker-driven
// binding identity and the exact wrapper transparency of reference chains.
//
// References resolve through the TypeScript checker, so shadows and
// redeclarations must not leak between bindings, `export { x as y }` must
// resolve to the local variable, and a `typeof x` query is a real (escaping)
// reference. Wrapper handling is asymmetric by upstream's ESTree shape:
// parentheses are invisible everywhere, but a TS assertion around a member
// blocks call/assignment detection because upstream inspects the member's
// direct parent. Each arm pins one of those identity decisions.
//
//  1. Declare shadowed, redeclared, exported, type-queried, and
//     wrapper-consumed objects with used/unused twins.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert exactly the `/* unused:NAME */`-marked properties are reported.
func TestUnicornNoUnusedPropertiesReferenceIdentity(t *testing.T) {
  source := `export {};
declare function consume(...values: unknown[]): void;

const shadowed = { outerUsed: 1, /* unused:outerDrop */ outerDrop: 2 };
consume(shadowed.outerUsed);
function shade(): void {
  const shadowed = { innerUsed: 1, /* unused:innerDrop */ innerDrop: 2 };
  consume(shadowed.innerUsed);
}
consume(shade);

var redeclared = { onceUsed: 1, neverUsed: 2 };
var redeclared;
consume(redeclared.onceUsed);

const renamed = { openUsed: 1, openSpare: 2 };
consume(renamed.openUsed);
export { renamed as published };

const queried = { viaType: 1, alsoViaType: 2 };
type Queried = typeof queried;
consume(queried.viaType, null as unknown as Queried);

const parenCalled = { run() {}, tail: 1 };
(parenCalled.run)();

const wrapperCalled = { go() {}, /* unused:wrapperTail */ wrapperTail: 1 };
(wrapperCalled.go as () => void)();
consume(wrapperCalled.go);

const parenAssigned = { slot: 1, follower: 2 };
(parenAssigned.slot) = 3;

const wrapperAssigned = { cell: 1, /* unused:cellMate */ cellMate: 2 };
(wrapperAssigned.cell as number) = 3;
consume(wrapperAssigned.cell);

const defaultTarget = { fallback: 1, /* unused:beside */ beside: 2 };
declare const cells: number[];
[defaultTarget.fallback = 1] = cells;

const removed = { cut: 1, kept: 2 } as { cut?: number; kept?: number };
delete removed.cut;
consume(removed.kept);
`
  assertUnusedPropertiesFindings(t, source)
}
