package linthost

import "testing"

// TestNoUnsafeAssignmentMappedTypes covers direct mapped-type boundaries and
// the upstream rule's refusal to walk arbitrary structural properties.
//
// 1. Assign direct `any` into a mapped receiver and require a finding.
// 2. Assign one mapped instantiation to another as the structural-boundary twin.
// 3. Keep an identical mapped instantiation as the safe same-type control.
func TestNoUnsafeAssignmentMappedTypes(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `type Mapped<T> = { [Key in "value"]: T };
declare const leaked: any;
declare const mappedAny: Mapped<any>;
declare const mappedString: Mapped<string>;

// expect: typescript/no-unsafe-assignment error
const direct: Mapped<string> = leaked;
const structuralBoundary: Mapped<string> = mappedAny;
const safe: Mapped<string> = mappedString;

void [direct, structuralBoundary, safe];
`)
}
