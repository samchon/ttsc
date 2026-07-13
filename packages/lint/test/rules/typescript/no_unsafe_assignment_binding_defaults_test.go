package linthost

import "testing"

// TestNoUnsafeAssignmentBindingDefaults covers defaults nested inside binding
// and destructuring-assignment patterns.
//
// 1. Use `any` fallbacks in object and array binding patterns.
// 2. Repeat the fallback through an object destructuring assignment.
// 3. Keep typed fallbacks beside them and require one finding per `any` default.
func TestNoUnsafeAssignmentBindingDefaults(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;
declare const objectSource: { value?: string; safe?: string };
declare const arraySource: [string?];

const {
  // expect: typescript/no-unsafe-assignment error
  value = leaked,
  safe = "value",
} = objectSource;
const [
  // expect: typescript/no-unsafe-assignment error
  arrayValue = leaked,
] = arraySource;

let assigned: string | undefined;
({
  // expect: typescript/no-unsafe-assignment error
  assigned = leaked,
} = { assigned: "value" });

void [value, safe, arrayValue, assigned];
`)
}
