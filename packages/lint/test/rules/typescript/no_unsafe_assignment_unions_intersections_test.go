package linthost

import "testing"

// TestNoUnsafeAssignmentUnionsAndIntersections covers direct composite
// receivers and the upstream same-reference comparison boundary.
//
// 1. Assign direct `any` into union and intersection receiver types.
// 2. Keep `unknown` and structurally different composite references as twins.
// 3. Require only the direct `any` escapes to report.
func TestNoUnsafeAssignmentUnionsAndIntersections(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `type Box<T> = { value: T };
type UnionTarget = string | number;
type IntersectionTarget = { value: string } & { tag: string };
declare const leaked: any;
declare const unionBox: Box<any> | undefined;
declare const intersectionBox: Box<any> & { tag: string };

// expect: typescript/no-unsafe-assignment error
const directUnion: UnionTarget = leaked;
// expect: typescript/no-unsafe-assignment error
const directIntersection: IntersectionTarget = leaked;
const boundary: unknown | string = leaked;
const compositeUnion: Box<string> | undefined = unionBox;
const compositeIntersection: Box<string> & { tag: string } = intersectionBox;

void [
  directUnion,
  directIntersection,
  boundary,
  compositeUnion,
  compositeIntersection,
];
`)
}
