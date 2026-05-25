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
func TestLSPPositionCountsNonBMPAsTwoUTF16Units(t *testing.T) {
  text := "x𐐷var"
  position := byteOffsetToLSPPosition(text, len("x𐐷"))
  if position.Line != 0 || position.Character != 3 {
    t.Fatalf("position: want line 0 character 3, got line %d character %d", position.Line, position.Character)
  }
}
