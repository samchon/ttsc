package linthost

import "testing"

// TestFormatPrintWidthBreaksOverflowingReactHookDepsArray pins the negative twin
// of the first-argument deps-array hug: when the deps array overflows the close
// line, Prettier keeps the callback hugged but breaks the deps array
// one-element-per-line (its dedicated isReactHookCallWithDepsArray path prints
// the array through a normal breakable group). The short-deps case stays flat
// (covered elsewhere); this case must break.
func TestFormatPrintWidthBreaksOverflowingReactHookDepsArray(t *testing.T) {
  assertFormatUnchanged(t, `useEffect(() => {
  doSomethingWithTheValues();
}, [
  firstDependencyValueHere,
  secondDependencyValueHere,
  thirdDependencyValueHere,
]);
`)
}
