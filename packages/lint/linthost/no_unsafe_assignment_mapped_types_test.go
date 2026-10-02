package linthost

import "testing"

// TestNoUnsafeAssignmentMappedTypes covers direct mapped-type boundaries and
// the upstream rule's refusal to walk arbitrary structural properties.
//
// 1. Assign direct `any` into a mapped receiver and require a finding.
// 2. Assign one mapped instantiation to another as the structural-boundary twin.
// 3. Keep an identical mapped instantiation as the safe same-type control.
//
// @evidence contracts/testing.md#behavioral-verification Direct any detection must preserve the supported mapped structural-comparison boundary.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored direct-any to Mapped<string> finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases mappedAny structural-boundary and identical mappedString assignments are intentionally unreported; this is rule policy rather than proof of runtime safety.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentMappedTypes invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
