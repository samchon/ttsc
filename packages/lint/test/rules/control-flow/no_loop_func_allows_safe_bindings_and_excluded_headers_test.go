package linthost

import "testing"

// TestNoLoopFuncAllowsSafeBindingsAndExcludedHeaders verifies the official
// negative twins for closures that cannot observe a later mutable value.
//
// Const bindings, iteration-created lets, no-capture closures, type-only uses,
// unresolved runtime names, functions in excluded loop-header positions, and
// computed method names are safe even though each sits beneath a loop node.
//
// 1. Exercise each safe binding class plus destructuring and shadowing.
// 2. Place closures in a for initializer and for-in/of right-hand expressions.
// 3. Mutate adjacent outer bindings and assert the rule remains silent.
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
