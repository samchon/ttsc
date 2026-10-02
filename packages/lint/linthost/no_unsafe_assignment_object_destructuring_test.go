package linthost

import "testing"

// TestNoUnsafeAssignmentObjectDestructuring covers direct, property, computed,
// and nested object-pattern boundaries.
//
// 1. Destructure direct `any` and an object with unsafe and safe properties.
// 2. Reach a second `any` through a nested pattern and a literal computed key.
// 3. Require each unsafe boundary once while leaving `unknown` clean.
//
// @evidence contracts/testing.md#behavioral-verification Object patterns must expose direct, nested and computed-key any leaves.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require four authored direct, bad, nestedBad and numeric findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases string and unknown selected properties stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentObjectDestructuring invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentObjectDestructuring(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const direct: any;
declare const object: {
  bad: any;
  safe: string;
  boundary: unknown;
  nested: { bad: any };
  1: any;
};

// expect: typescript/no-unsafe-assignment error
const { directValue } = direct;
const {
  // expect: typescript/no-unsafe-assignment error
  bad,
  safe,
  boundary,
  nested: {
    // expect: typescript/no-unsafe-assignment error
    bad: nestedBad,
  },
  // expect: typescript/no-unsafe-assignment error
  [1]: numeric,
} = object;

void [directValue, bad, safe, boundary, nestedBad, numeric];
`)
}
