package linthost

import "testing"

// TestUnicornSliceEndPreservesOtherReceiverBounds verifies a slice bound belongs to the array being sliced.
//
// An unrelated array length can truncate the slice. Re-evaluating a receiver call can also obtain a different array.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/no-unnecessary-slice-end; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations An unrelated array length can truncate the slice. Re-evaluating a receiver call can also obtain a different array.
// @evidence contracts/testing.md#distinguishing-cases Foreign receiver lengths and repeated calls are excluded; matching receiver length and Infinity retain report-only advice.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses the owning Engine and shared finding helpers in process without installation or a native host.
func TestUnicornSliceEndPreservesOtherReceiverBounds(t *testing.T) {
  for _, source := range []string{
    "const xs = [1,2,3], other = [0]; const value = xs.slice(0, other.length);",
    "declare function getXs(): number[]; const value = getXs().slice(0, getXs().length);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/no-unnecessary-slice-end", source) })
  }
  for _, source := range []string{
    "const xs = [1,2,3]; const value = xs.slice(0, xs.length);",
    "const xs = [1,2,3]; const value = xs.slice(0, Infinity);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/no-unnecessary-slice-end", source) })
  }
}

