package linthost

import "testing"

// TestNoUnsafeAssignmentJsxAttributes covers contextual JSX expression
// attributes and their `unknown` receiver boundary.
//
// 1. Declare intrinsic attributes with string and unknown receiver types.
// 2. Pass the same `any` expression to both attributes.
// 3. Require only the concrete attribute to report.
func TestNoUnsafeAssignmentJsxAttributes(t *testing.T) {
  assertNoUnsafeAssignmentTSXCase(t, `declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    widget: { value: string; boundary: unknown };
  }
}

declare const leaked: any;

// expect: typescript/no-unsafe-assignment error
const view = <widget value={leaked} boundary={leaked} />;

void view;
`)
}
