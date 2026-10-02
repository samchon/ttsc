package linthost

import "testing"

// TestNoUnsafeAssignmentObjectLiterals covers contextual property assignments
// in explicit and shorthand object literals.
//
// 1. Place `any` in named and shorthand properties with concrete contexts.
// 2. Repeat the named property with an `unknown` context as the safe boundary.
// 3. Require one finding for each concrete contextual property.
//
// @evidence contracts/testing.md#behavioral-verification Contextual object literals must inspect named and shorthand property assignments.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored concrete-context named and shorthand findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown-valued object property stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentObjectLiterals invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
