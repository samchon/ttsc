package linthost

import "testing"

// TestNoUnsafeAssignmentDirectDeclarations covers direct `any` assignment to
// annotated and inferred variables while preserving the `unknown` boundary.
//
// 1. Assign one `any` source to annotated, inferred, and `unknown` receivers.
// 2. Keep a normally typed initializer as the safe twin.
// 3. Require findings only for the annotated and inferred escapes.
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
