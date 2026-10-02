package linthost

import "testing"

// TestEngineLiterallineEmitsNewlineAtColumnZero verifies Literalline
// emits a newline without applying any indent, so the next character
// lands at column 0 regardless of the surrounding Indent depth.
//
// The authored Indent four must not add spaces after this Literalline.
// Literal a-LF-b output distinguishes it from Hardline under the same
// indentation. This case observes bytes, not the internal column counter
// or later group-fit decisions.
//
// @evidence contracts/testing.md#behavioral-verification Print must emit b at column zero after Literalline despite an enclosing Indent four.
// @evidence contracts/testing.md#independent-expectations Literalline suppresses continuation indentation by contract; the literal a\nb retains both payloads.
// @evidence contracts/testing.md#distinguishing-cases This no-indent break complements the ordinary Hardline-plus-Indent case.
// @evidence contracts/testing.md#execution-ownership TestEngineLiterallineEmitsNewlineAtColumnZero is one Go unit entry that renders a literal Indent containing a Literalline with Print under default options in-process; it parses no source and installs, builds and launches nothing.
func TestEngineLiterallineEmitsNewlineAtColumnZero(t *testing.T) {
  doc := Indent(4, Text("a"), Literalline(), Text("b"))
  got := Print(doc, DefaultPrintOptions())
  if got != "a\nb" {
    t.Fatalf("literalline at-column-zero mismatch: %q", got)
  }
}
