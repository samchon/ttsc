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
// current predicate binary-searches source-ordered child ranges. This
// changing fixture distinguishes masked string bytes from a comment
// that would suppress reflow; the full authored layout preserves every
// URL. It does not measure an earlier scanner or a speed improvement.
//
//  1. Configure printWidth=40 so the 3-element array overflows.
//  2. Run formatPrintWidth on an array of `"http://…"` strings.
//  3. Assert the canonical one-element-per-line reflow with a trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the reflows wide array with slash strings fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the canonical one-element-per-line reflow with a trailing comma.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=40 so the 3-element array overflows. The asserted decision is: Assert the canonical one-element-per-line reflow with a trailing comma. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthReflowsWideArrayWithSlashStrings is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthReflowsWideArrayWithSlashStrings(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const urls = [\"http://a.example.com/x\", \"http://b.example.com/y\", \"http://c.example.com/z\"];\n",
    `{"printWidth": 40}`,
    "const urls = [\n  \"http://a.example.com/x\",\n  \"http://b.example.com/y\",\n  \"http://c.example.com/z\",\n];\n",
  )
}
