package linthost

import "testing"

// TestUnicornNegativeIndexRequiresItsOwnReceiverAndIndexArgument verifies negative-index advice concerns an index derived from that receiver.
//
// lastIndexOf takes a search value as its first argument. Other-array lengths and repeated receiver calls do not identify this array's tail.
//
// 1. Run the owning rule on the authored load-bearing arguments.
// 2. Require zero findings on those inputs.
// 3. Preserve report-only diagnostics for the adjacent ordinary idioms.
//
// @evidence contracts/testing.md#behavioral-verification Engine runs unicorn/prefer-negative-index; zero-finding negatives distinguish the named argument boundary and report-only positives require activation without automatic edits.
// @evidence contracts/testing.md#independent-expectations lastIndexOf takes a search value as its first argument. Other-array lengths and repeated receiver calls do not identify this array's tail.
// @evidence contracts/testing.md#distinguishing-cases Foreign lengths, repeated calls and lastIndexOf search values are excluded; matching at/slice first index arguments retain report-only advice.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses the owning Engine and shared finding helpers in process without installation or a native host.
func TestUnicornNegativeIndexRequiresItsOwnReceiverAndIndexArgument(t *testing.T) {
  for _, source := range []string{
    "const xs = [1,2], other = [0]; const value = xs.at(other.length - 1);",
    "const xs = [1,2], other = [0]; const value = xs.slice(other.length - 1);",
    "const xs = [1,2]; const value = xs.lastIndexOf(xs.length - 1);",
    "declare function getXs(): number[]; const value = getXs().at(getXs().length - 1);",
  } {
    t.Run(source, func(t *testing.T) { assertRuleSkipsSource(t, "unicorn/prefer-negative-index", source) })
  }
  for _, source := range []string{
    "const xs = [1,2]; const value = xs.at(xs.length - 1);",
    "const xs = [1,2]; const value = xs.slice(xs.length - 1);",
  } {
    t.Run(source, func(t *testing.T) { assertReportOnlySnapshot(t, "unicorn/prefer-negative-index", source) })
  }
}

