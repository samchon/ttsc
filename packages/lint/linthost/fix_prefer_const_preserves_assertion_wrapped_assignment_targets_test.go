package linthost

import "testing"

// TestFixPreferConstPreservesAssertionWrappedAssignmentTargets verifies every
// TypeScript reference wrapper remains transparent to write tracking.
//
// The mutable bindings cover simple and compound assignments, prefix and
// postfix updates, for-in/of targets, nested wrappers, and array/object
// destructuring defaults. The member target is the negative boundary: writing
// through holder.value does not reassign holder, so holder and the unrelated
// stable binding must still receive the ordinary let-to-const fix.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const retains mutable bindings through assertion-wrapped assignment/update/loop/destructuring targets while fixing holder and stable.
// @evidence contracts/testing.md#independent-expectations The full literal expected source changes only holder/stable to const; all ten mutable binding declarations and writes remain independently spelled.
// @evidence contracts/testing.md#distinguishing-cases as, angle brackets, satisfies, non-null, parentheses and nested patterns wrap writes; assigning holder.value does not reassign holder.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstPreservesAssertionWrappedAssignmentTargets runs assertFixSnapshot over the complete checker-backed matrix.
func TestFixPreferConstPreservesAssertionWrappedAssignmentTargets(t *testing.T) {
  source := `let simple = 0;
(simple as number) = 1;
let compound = 0;
(<number>compound) += 1;
let postfix = 0;
(postfix satisfies number)++;
let prefix = 0;
++((prefix as number));
let nested = 0;
((((nested!) as number) satisfies number)) = 1;
let fromForOf = 0;
for ((fromForOf as number) of [1, 2]) {}
let fromForIn = "";
for ((fromForIn satisfies string) in { key: true }) {}
let arrayValue = 0;
let defaulted = 0;
[((arrayValue as number)), ((defaulted satisfies number)) = 1] = [2];
let objectValue = 0;
({ value: (<number>objectValue) } = { value: 3 });
let holder = { value: 0 };
(holder.value as number) = 4;
let stable = 1;
console.log(simple, compound, postfix, prefix, nested, fromForOf, fromForIn, arrayValue, defaulted, objectValue, holder, stable);
`
  expected := `let simple = 0;
(simple as number) = 1;
let compound = 0;
(<number>compound) += 1;
let postfix = 0;
(postfix satisfies number)++;
let prefix = 0;
++((prefix as number));
let nested = 0;
((((nested!) as number) satisfies number)) = 1;
let fromForOf = 0;
for ((fromForOf as number) of [1, 2]) {}
let fromForIn = "";
for ((fromForIn satisfies string) in { key: true }) {}
let arrayValue = 0;
let defaulted = 0;
[((arrayValue as number)), ((defaulted satisfies number)) = 1] = [2];
let objectValue = 0;
({ value: (<number>objectValue) } = { value: 3 });
const holder = { value: 0 };
(holder.value as number) = 4;
const stable = 1;
console.log(simple, compound, postfix, prefix, nested, fromForOf, fromForIn, arrayValue, defaulted, objectValue, holder, stable);
`
  assertFixSnapshot(t, "prefer-const", source, expected)
}
