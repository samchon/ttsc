package linthost

import "testing"

// TestUnicornSpliceCountPreservesBoundsAndInsertions verifies splice count omission retains argument positions and receiver ownership.
//
// A foreign length can delete fewer elements. Removing a count before insertion arguments makes the first insertion become the count.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/no-unnecessary-array-splice-count; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations A foreign length can delete fewer elements. Removing a count before insertion arguments makes the first insertion become the count.
// @evidence contracts/testing.md#distinguishing-cases Foreign lengths, insertion arguments and repeated calls are excluded for splice/toSpliced; exactly two matching-bound arguments retain report-only advice.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses the owning Engine and shared finding helpers in process without installation or a native host.
func TestUnicornSpliceCountPreservesBoundsAndInsertions(t *testing.T) {
  for _, source := range []string{
    "const xs = [1,2,3], other = [0]; xs.splice(0, other.length);",
    "const xs = [1,2,3], other = [0]; xs.toSpliced(0, other.length);",
    "const xs = [1,2,3]; xs.splice(0, Infinity, 42);",
    "const xs = [1,2,3]; xs.toSpliced(0, xs.length, 42);",
    "declare function getXs(): number[]; getXs().splice(0, getXs().length);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/no-unnecessary-array-splice-count", source) })
  }
  for _, source := range []string{
    "const xs = [1,2,3]; xs.splice(0, xs.length);",
    "const xs = [1,2,3]; xs.toSpliced(0, Infinity);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/no-unnecessary-array-splice-count", source) })
  }
}

