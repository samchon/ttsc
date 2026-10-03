package linthost

import "testing"

// TestNoUnsafeAssignmentBindingDefaults covers defaults nested inside binding
// and destructuring-assignment patterns.
//
// 1. Use `any` fallbacks in object and array binding patterns.
// 2. Repeat the fallback through an object destructuring assignment.
// 3. Keep typed fallbacks beside them and require one finding per `any` default.
//
// @evidence contracts/testing.md#behavioral-verification Binding defaults must inspect unsafe fallback expressions at nested assignment sites.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require three authored object, array and reassignment fallback findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases typed string defaults remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentBindingDefaults invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
