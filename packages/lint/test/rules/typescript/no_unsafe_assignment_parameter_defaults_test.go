package linthost

import "testing"

// TestNoUnsafeAssignmentParameterDefaults covers regular defaults and
// constructor parameter-property defaults.
//
// 1. Default a function parameter and a parameter property from `any`.
// 2. Pair them with an `unknown` parameter and a typed default.
// 3. Require one finding at each unsafe default boundary.
func TestNoUnsafeAssignmentParameterDefaults(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;

function regular(
  // expect: typescript/no-unsafe-assignment error
  value: string = leaked,
  boundary: unknown = leaked,
): void {
  void [value, boundary];
}

class Example {
  public constructor(
    // expect: typescript/no-unsafe-assignment error
    public value: string = leaked,
    public safe = "value",
  ) {}
}

void [regular, Example];
`)
}
