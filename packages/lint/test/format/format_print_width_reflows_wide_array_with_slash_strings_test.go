package linthost

import "testing"

// TestFormatPrintWidthReflowsWideArrayWithSlashStrings locks the reflow output
// of a wide array literal whose string children contain `//` byte sequences,
// pinning the byte-identical result the `inChild` binary-search predicate must
// preserve.
//
// `hasNonChildComments` scans the node's byte range for `//`/`/*` and abstains
// when one falls OUTSIDE every child range, so `inChild` must correctly mask
// the `//` inside each `"http://…"` string element (those are children). The
// predicate was refactored from a per-byte linear scan to a binary search over
// the source-ordered, non-overlapping child ranges; this case proves the
// refactor still reflows the array (rather than mistaking an in-string `//`
// for a comment and abstaining) and produces exactly the multi-line form it
// produced before — a pure-speedup, output-preserving change.
//
//  1. Configure printWidth=40 so the 3-element array overflows.
//  2. Run formatPrintWidth on an array of `"http://…"` strings.
//  3. Assert the canonical one-element-per-line reflow with a trailing comma.
func TestFormatPrintWidthReflowsWideArrayWithSlashStrings(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const urls = [\"http://a.example.com/x\", \"http://b.example.com/y\", \"http://c.example.com/z\"];\n",
    `{"printWidth": 40}`,
    "const urls = [\n  \"http://a.example.com/x\",\n  \"http://b.example.com/y\",\n  \"http://c.example.com/z\",\n];\n",
  )
}
