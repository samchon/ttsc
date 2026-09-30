package linthost

import "testing"

// TestNoUnsafeAssignmentParameterDefaults covers regular defaults and
// constructor parameter-property defaults.
//
// 1. Default a function parameter and a parameter property from `any`.
// 2. Pair them with an `unknown` parameter and a typed default.
// 3. Require one finding at each unsafe default boundary.
// @evidence contracts/testing.md#behavioral-verification Parameter defaults must inspect regular and constructor parameter-property initializers.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored regular and parameter-property findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown parameter and typed constructor default stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentParameterDefaults invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
