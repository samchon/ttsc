package linthost

import "unicode"

// displayWidth returns the number of terminal columns a string occupies,
// matching Prettier's getStringWidth: an ASCII string's width equals its byte
// length, a zero-width combining mark counts as zero, and a wide East Asian
// (or emoji) code point counts as two. Width decisions across the formatter,
// the layout engine's fit checks and the print-width rule's source measurement,
// must use display columns rather than byte length, or a multi-byte token (a
// subscript digit, a Hangul or CJK identifier) is over-counted and the line is
// wrongly broken.
//
// A tab counts as one column here; callers that need tab-stop expansion handle
// it separately (the layout engine emits indentation outside of Text nodes, so
// an embedded tab is rare and was already charged as one byte before this).
func displayWidth(s string) int {
  w := 0
  for _, r := range s {
    w += runeWidth(r)
  }
  return w
}

// displayWidthAfterLastNewline returns the display width of the substring that
// follows the final newline in s (the whole string when it has none). The
// layout engine uses it to reset the running column after emitting a verbatim
// slice that spans lines.
func displayWidthAfterLastNewline(s string) int {
  for i := len(s) - 1; i >= 0; i-- {
    if s[i] == '\n' {
      return displayWidth(s[i+1:])
    }
  }
  return displayWidth(s)
}

// runeWidth returns the column width of a single rune: zero for a combining
// mark or zero-width space, two for a wide East Asian or emoji code point, one
// otherwise (tabs included, see displayWidth).
func runeWidth(r rune) int {
  if r == 0x200B || unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r) {
    return 0
  }
  if isWideRune(r) {
    return 2
  }
  return 1
}

// isWideRune reports whether a rune renders in two terminal columns, covering
// the East Asian Wide / Fullwidth ranges and the common emoji blocks the way
// Prettier's width table does.
func isWideRune(r rune) bool {
  switch {
  case r >= 0x1100 && r <= 0x115F, // Hangul Jamo
    r >= 0x2E80 && r <= 0x303E, // CJK Radicals .. CJK Symbols (part)
    r >= 0x3041 && r <= 0x33FF, // Hiragana .. CJK Compatibility
    r >= 0x3400 && r <= 0x4DBF, // CJK Extension A
    r >= 0x4E00 && r <= 0x9FFF, // CJK Unified Ideographs
    r >= 0xA000 && r <= 0xA4CF, // Yi
    r >= 0xAC00 && r <= 0xD7A3, // Hangul Syllables
    r >= 0xF900 && r <= 0xFAFF, // CJK Compatibility Ideographs
    r >= 0xFE30 && r <= 0xFE4F, // CJK Compatibility Forms
    r >= 0xFF00 && r <= 0xFF60, // Fullwidth Forms
    r >= 0xFFE0 && r <= 0xFFE6, // Fullwidth signs
    r >= 0x1F300 && r <= 0x1FAFF, // emoji & pictographs
    r >= 0x20000 && r <= 0x3FFFD: // CJK Extension B and beyond
    return true
  }
  return false
}
