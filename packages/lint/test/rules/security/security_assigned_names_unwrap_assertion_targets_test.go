package linthost

import "testing"

// TestSecurityAssignedNamesUnwrapAssertionTargets pins every write context
// consumed by the security rules while keeping member writes out of the local
// binding set.
func TestSecurityAssignedNamesUnwrapAssertionTargets(t *testing.T) {
  file := parseTS(t, `let simple = 0;
(simple as number) = input;
let compound = 0;
(<number>compound) += input;
let prefix = 0;
++((prefix satisfies number));
let postfix = 0;
((postfix as number))++;
let fromForOf = 0;
for ((fromForOf as number) of values) {}
let fromForIn = "";
for ((fromForIn satisfies string) in values) {}
let arrayValue = 0;
let objectValue = 0;
[(arrayValue as number), { value: (<number>objectValue) }] = values;
let nested = 0;
((((nested!) as number) satisfies number)) = input;
let holder = { value: 0 };
(holder.value as number) = input;
`)

  assigned := collectSecurityAssignedNames(file.AsNode())
  for _, name := range []string{
    "simple",
    "compound",
    "prefix",
    "postfix",
    "fromForOf",
    "fromForIn",
    "arrayValue",
    "objectValue",
    "nested",
  } {
    if !assigned[name] {
      t.Errorf("assertion-wrapped write to %q was not collected", name)
    }
  }
  if assigned["holder"] {
    t.Fatal("member write was misclassified as a write to the holder binding")
  }
}
