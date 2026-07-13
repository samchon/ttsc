package linthost

import "testing"

// TestNoUnsafeAssignmentObjectDestructuring covers direct, property, computed,
// and nested object-pattern boundaries.
//
// 1. Destructure direct `any` and an object with unsafe and safe properties.
// 2. Reach a second `any` through a nested pattern and a literal computed key.
// 3. Require each unsafe boundary once while leaving `unknown` clean.
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
