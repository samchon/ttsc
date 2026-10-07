package linthost

import "testing"

// TestLSPPositionCountsNonBMPAsTwoUTF16Units verifies LSP range conversion
// uses UTF-16 code units.
//
// VS Code indexes positions in UTF-16, while TypeScript-Go findings use byte
// offsets. A non-BMP rune before the edit must count as two characters, or
// WorkspaceEdits after emoji-like characters land one column early.
//
// 1. Build source text containing one non-BMP rune before `var`.
// 2. Convert the byte offset at `var` to an LSP position.
// 3. Assert the character offset is 3: `x` plus the two UTF-16 units.
//
// @evidence contracts/testing.md#behavioral-verification byteOffsetToLSPPosition places the first var byte after x and the authored astral Deseret rune at line zero, UTF-16 character three.
// @evidence contracts/testing.md#independent-expectations ASCII x contributes one UTF-16 code unit and the literal U+10437 rune contributes a surrogate pair, giving the authored numeric expectation three independently of the conversion.
// @evidence contracts/testing.md#distinguishing-cases An astral prefix separates byte count, scalar count and UTF-16 count; the exact var boundary rejects either byte-indexing or one-unit-per-rune conversion. The wider companion table owns line endings, BMP and clamping boundaries.
// @evidence contracts/testing.md#execution-ownership A direct raw-text conversion executes in the shared Go process on a literal string. This unit owns byteOffsetToLSPPosition, not an assertion that all diagnostic/edit consumers use that helper; no filesystem, native build or consumer host runs.
func TestLSPPositionCountsNonBMPAsTwoUTF16Units(t *testing.T) {
  text := "x𐐷var"
  position := byteOffsetToLSPPosition(text, len("x𐐷"))
  if position.Line != 0 || position.Character != 3 {
    t.Fatalf("position: want line 0 character 3, got line %d character %d", position.Line, position.Character)
  }
}
