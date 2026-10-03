package linthost

import "testing"

// TestNoLoopFuncAllowsSafeBindingsAndExcludedHeaders verifies the official
// negative twins for the rule's exempt bindings and reference positions.
//
// Const bindings, iteration-created lets, no-capture closures, type-only uses,
// unresolved runtime names, functions in excluded loop-header positions, and
// computed method names are excluded even though each sits beneath a loop node.
// A loop-local let can still change within its iteration; exemption does not
// assert runtime immutability or that its closure cannot observe that change.
//
// 1. Exercise each safe binding class plus destructuring and shadowing.
// 2. Place closures in a for initializer and for-in/of right-hand expressions.
// 3. Mutate adjacent outer bindings and assert the rule remains silent.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed rule findings must be empty for every original safe capture, excluded loop header and same-name local case.
// @evidence contracts/testing.md#independent-expectations Stable-before-loop, const and per-iteration let identities independently avoid later mutable captures; type-only uses and excluded header positions are supported policy exclusions.
// @evidence contracts/testing.md#distinguishing-cases No capture, stable/const/iteration/destructured/shadow/type-only/unresolved/computed-name captures and initializer/iterable-header closures stay clean; ReportsOnlyUnsafeReferences and TracksWriteFormsAndSymbolIdentity own dangerous counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoLoopFuncAllowsSafeBindingsAndExcludedHeaders is selected in the shared Go unit population. It calls runNoLoopFunc and assertNoLoopFuncFindings through the owning Engine with a real Program/Checker; all authored in-source cases belong to this entry. No installed consumer, native artifact build or real product host runs.
func TestNoLoopFuncAllowsSafeBindingsAndExcludedHeaders(t *testing.T) {
  source := `let stable = 0;
stable = 1;
let headerOnly = 0;
let typeOnly = 0;
let computedNameOnly = 0;
const fixed = 1;
for (let iteration = 0; iteration < 2; iteration++) {
  const noCapture = () => 42;
  const stableCapture = () => stable;
  const constCapture = () => fixed;
  const iterationCapture = () => iteration;
  const typed = (): typeof typeOnly => 1;
  // @ts-ignore -- unresolved runtime names belong to no-undef, not no-loop-func.
  const unresolved = () => missingRuntime;
  {
    let shadow = 0;
    const shadowCapture = () => shadow;
    shadow++;
    void shadowCapture;
  }
  void [noCapture, stableCapture, constCapture, iterationCapture, typed, unresolved];
}
for (let initializer = () => headerOnly; false; ) {
  void initializer;
}
for (const candidate of [() => headerOnly]) {
  void candidate;
}
for (const key in { candidate: () => headerOnly }) {
  void key;
}
for (let [left, right] of [[1, 2]]) {
  const destructured = () => left + right;
  void destructured;
}
for (let iteration = 0; iteration < 1; iteration++) {
  const object = { [computedNameOnly]() { return 1; } };
  void object;
}
headerOnly = 1;
typeOnly = 1;
computedNameOnly = 1;
`
  assertNoLoopFuncFindings(t, runNoLoopFunc(t, source))
}
