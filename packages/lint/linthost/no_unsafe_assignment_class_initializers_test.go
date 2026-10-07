package linthost

import "testing"

// TestNoUnsafeAssignmentClassInitializers covers fields and TypeScript
// auto-accessors with inferred receiver types.
//
// 1. Initialize one field and one auto-accessor from `any`.
// 2. Add `unknown` and normally typed class members as safe twins.
// 3. Require one finding for each inferred unsafe member.
//
// @evidence contracts/testing.md#behavioral-verification Class member initializers must inspect inferred field and auto-accessor types.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored field and accessor findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases explicit unknown and string members remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentClassInitializers invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentClassInitializers(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;

class Example {
  // expect: typescript/no-unsafe-assignment error
  public field = leaked;
  // expect: typescript/no-unsafe-assignment error
  public accessor value = leaked;
  public boundary: unknown = leaked;
  public safe = "value";
}

void Example;
`)
}
