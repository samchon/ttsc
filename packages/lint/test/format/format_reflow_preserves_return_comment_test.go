package linthost

import "testing"

// TestFormatReflowPreservesReturnComment pins the data-safety guard for a
// comment between `return` and its argument. The return lives inside a hugged
// callback block (a nested child), so the top-level print-width and block
// comment scans mask it; without the printReturnStatement leading-gap guard the
// minted `return ` drops `/* keep */`. With the guard the statement reports
// uncovered, the enclosing reflow abstains, and the bytes survive verbatim.
func TestFormatReflowPreservesReturnComment(t *testing.T) {
  assertFormatUnchanged(t, `const wrapped = makeWrapperWithAName(() => {
  return /* keep */ someObjectValueWithAQuiteLongNameThatOverflowsThePrintWidth;
});
`)
}
