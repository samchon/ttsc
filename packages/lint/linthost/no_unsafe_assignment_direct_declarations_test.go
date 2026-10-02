package linthost

import "testing"

// TestNoUnsafeAssignmentDirectDeclarations covers direct `any` assignment to
// annotated and inferred variables while preserving the `unknown` boundary.
//
// 1. Assign one `any` source to annotated, inferred, and `unknown` receivers.
// 2. Keep a normally typed initializer as the safe twin.
// 3. Require findings only for the annotated and inferred escapes.
//
// @evidence contracts/testing.md#behavioral-verification Direct any must report when assigned to inferred or concrete variable types.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored annotated and inferred declaration findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown receiver and typed initializer stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentDirectDeclarations invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentDirectDeclarations(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;

// expect: typescript/no-unsafe-assignment error
const annotated: string = leaked;
// expect: typescript/no-unsafe-assignment error
const inferred = leaked;
const boundary: unknown = leaked;
const safe = "value";

void [annotated, inferred, boundary, safe];
`)
}
