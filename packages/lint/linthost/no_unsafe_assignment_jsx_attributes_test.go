package linthost

import "testing"

// TestNoUnsafeAssignmentJsxAttributes covers contextual JSX expression
// attributes and their `unknown` receiver boundary.
//
// 1. Declare intrinsic attributes with string and unknown receiver types.
// 2. Pass the same `any` expression to both attributes.
// 3. Require only the concrete attribute to report.
//
// @evidence contracts/testing.md#behavioral-verification JSX assignments must use contextual attribute types.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored concrete widget attribute finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases the same any expression assigned to the unknown attribute stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentJsxAttributes invokes assertNoUnsafeAssignmentTSXCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
