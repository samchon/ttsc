package linthost

import "testing"

// TestNoUnsafeAssignmentUnionsAndIntersections covers direct composite
// receivers and the upstream same-reference comparison boundary.
//
// 1. Assign direct `any` into union and intersection receiver types.
// 2. Keep `unknown` and structurally different composite references as twins.
// 3. Require only the direct `any` escapes to report.
//
// @evidence contracts/testing.md#behavioral-verification Direct any must report into composite receivers while preserving the same-reference comparison boundary.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored direct union/intersection findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown and structurally different composite-reference assignments are intentionally unreported under the supported rule policy.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentUnionsAndIntersections invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
