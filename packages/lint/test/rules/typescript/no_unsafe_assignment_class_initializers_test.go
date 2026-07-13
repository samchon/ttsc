package linthost

import "testing"

// TestNoUnsafeAssignmentClassInitializers covers fields and TypeScript
// auto-accessors with inferred receiver types.
//
// 1. Initialize one field and one auto-accessor from `any`.
// 2. Add `unknown` and normally typed class members as safe twins.
// 3. Require one finding for each inferred unsafe member.
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
