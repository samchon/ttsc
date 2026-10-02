package linthost

import "testing"

// TestNoUnsafeAssignmentGenericConstraints covers direct `any` escaping into
// constrained type parameters without replacing the receiver by its constraint.
//
// 1. Assign `any` into object-constrained and unknown-constrained parameters.
// 2. Assign values already typed as each parameter as safe twins.
// 3. Require both direct `any` boundaries to report.
//
// @evidence contracts/testing.md#behavioral-verification A constrained receiver must retain type-parameter identity at a direct any assignment.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored object-constrained and unknown-constrained generic findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases values already typed as each parameter stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentGenericConstraints invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentGenericConstraints(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `function objectConstraint<T extends { value: string }>(leaked: any, value: T): void {
  // expect: typescript/no-unsafe-assignment error
  const unsafe: T = leaked;
  const safe: T = value;
  void [unsafe, safe];
}

function unknownConstraint<T extends unknown>(leaked: any, value: T): void {
  // expect: typescript/no-unsafe-assignment error
  const unsafe: T = leaked;
  const safe: T = value;
  void [unsafe, safe];
}

void [objectConstraint, unknownConstraint];
`)
}
