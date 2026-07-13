package linthost

import "testing"

// TestNoUnsafeAssignmentObjectLiterals covers contextual property assignments
// in explicit and shorthand object literals.
//
// 1. Place `any` in named and shorthand properties with concrete contexts.
// 2. Repeat the named property with an `unknown` context as the safe boundary.
// 3. Require one finding for each concrete contextual property.
func TestNoUnsafeAssignmentObjectLiterals(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;

const named: { value: string } = {
  // expect: typescript/no-unsafe-assignment error
  value: leaked,
};
const shorthand: { leaked: string } = {
  // expect: typescript/no-unsafe-assignment error
  leaked,
};
const boundary: { value: unknown } = { value: leaked };

void [named, shorthand, boundary];
`)
}
