package linthost

import "testing"

// TestNoFallthroughHonorsCustomCommentPattern verifies the commentPattern option accepts a matching custom marker.
//
// Upstream valid case with `commentPattern: "break omitted"`: a project can
// standardize its own marker wording, delivered through the typed rule
// options transport. Locks the custom-pattern compilation and matching path.
//
// 1. Mark the transition with `/* break omitted */`.
// 2. Run the engine with options {"commentPattern":"break omitted"}.
// 3. Assert zero findings.
func TestNoFallthroughHonorsCustomCommentPattern(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    /* break omitted */
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"break omitted"}`)
}
