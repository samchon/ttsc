package linthost

import "testing"

// TestEngineSoftlineEmitsNewlineWhenGroupBreaks verifies a Softline
// inside a broken Group emits a newline at each separator. The literal [ab]
// flat form needs four columns; width three requires the two authored newline
// boundaries with zero indentation. The sibling fitting case expects no
// separator bytes, distinguishing the two layout modes.
//
// @evidence contracts/testing.md#behavioral-verification Print must expand both Softlines and preserve brackets around ab at width three.
// @evidence contracts/testing.md#independent-expectations The flat [ab] needs four columns; the literal multiline form follows the broken Softline contract.
// @evidence contracts/testing.md#distinguishing-cases One-column-short budget complements empty Softline output when the group fits.
// @evidence contracts/testing.md#execution-ownership TestEngineSoftlineEmitsNewlineWhenGroupBreaks is one Go unit entry that renders a literal Group holding two Softlines with Print at PrintWidth 3 in-process; it parses no source and installs, builds and launches nothing.
func TestEngineSoftlineEmitsNewlineWhenGroupBreaks(t *testing.T) {
  doc := Group(Text("["), Softline(), Text("ab"), Softline(), Text("]"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 3
  got := Print(doc, opts)
  if got != "[\nab\n]" {
    t.Fatalf("broken softline mismatch: %q", got)
  }
}
