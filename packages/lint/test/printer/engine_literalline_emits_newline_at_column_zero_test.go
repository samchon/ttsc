package linthost

import "testing"

// TestEngineLiterallineEmitsNewlineAtColumnZero verifies Literalline
// emits a newline without applying any indent, so the next character
// lands at column 0 regardless of the surrounding Indent depth.
//
// Template-literal interior lines preserve their original source
// column, which may be column 0 even when the template expression sits
// inside several levels of indentation. Hardline would emit the
// surrounding indent (offsetting the text to the wrong column);
// Literalline must suppress it. This test pins the branch in Print
// that sets `col = 0` instead of calling `writeIndent`, ensuring
// Literalline stays distinct from Hardline under indentation.
//
//  1. Build Indent(4, Text("a"), Literalline(), Text("b")) — the
//     Indent carries a 4-column increment that Hardline would apply.
//  2. Print under default options.
//  3. Assert the second line starts at column 0: the output is "a\nb",
//     not "a\n    b".
func TestEngineLiterallineEmitsNewlineAtColumnZero(t *testing.T) {
  doc := Indent(4, Text("a"), Literalline(), Text("b"))
  got := Print(doc, DefaultPrintOptions())
  if got != "a\nb" {
    t.Fatalf("literalline at-column-zero mismatch: %q", got)
  }
}
