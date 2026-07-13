package linthost

import "testing"

// TestNoUnsafeAssignmentGenericConstraints covers direct `any` escaping into
// constrained type parameters without replacing the receiver by its constraint.
//
// 1. Assign `any` into object-constrained and unknown-constrained parameters.
// 2. Assign values already typed as each parameter as safe twins.
// 3. Require both direct `any` boundaries to report.
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
