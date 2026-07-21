package linthost

import (
  "regexp"
  "strings"
  "sync"
  "unicode/utf16"
)

//go:generate node ../tools/widthgen/main.cjs

// displayWidth returns the number of terminal columns a string occupies,
// matching Prettier's getStringWidth. Width decisions across the formatter —
// the layout engine's fit checks and the print-width rule's source measurement
// — must use display columns rather than byte length, or a multi-byte token (a
// subscript digit, a Hangul or CJK identifier) is over-counted and the line is
// wrongly broken.
//
// This is a transcription of `prettier/src/utilities/get-string-width.js`, not
// an implementation of the same idea. That distinction is the whole history of
// this function: it began as a hand-written 13-range table that diverged on
// 11,482 code points, and a first repair ported `string-width` — the package
// the report named — which Prettier does not use, and which regressed
// Devanagari, the Hangul fillers, the bidi controls, and 98 astral
// text-presentation emoji before it was reverted. The tables and the emoji
// pattern are generated from the module the lockfile pins, so there is no
// second source that can be right about a different Prettier.
//
// The procedure, in Prettier's order:
//
//  1. An empty string is zero, and a pure-ASCII string is its length. The fast
//     path is observable, not merely an optimization: U+007F returns 1 through
//     it although the loop below would skip it.
//  2. Every RGI emoji match is replaced by one space (for the ~65 Prettier
//     charges narrow) or two, so a sequence costs its own width and its code
//     points are never counted individually.
//  3. What remains is counted per code point, skipping C0/C1 controls, the
//     combining diacriticals U+0300-U+036F, and the variation selectors
//     U+FE00-U+FE0F, charging 2 for East Asian Wide or Fullwidth and 1
//     otherwise. Per CODE POINT, not per grapheme cluster: a combining mark
//     outside that one block is charged, which is why `हिंदी` is five columns.
//
// One deviation is deliberate and predates all of this: a tab counts as one
// column here, where Prettier's loop skips it as a control. Callers that need
// tab-stop expansion handle it separately, and the layout engine emits
// indentation outside the text it measures.
func displayWidth(s string) int {
  if s == "" {
    return 0
  }
  if !hasNonASCII(s) {
    return len(s)
  }
  width := 0
  for _, r := range replacePrettierEmoji(s) {
    switch {
    case r == '\t':
      // The documented deviation, kept so tab-stop expansion stays the caller's.
      width++
    case r <= 0x1F, r >= 0x7F && r <= 0x9F:
    case r >= 0x0300 && r <= 0x036F:
    case r >= 0xFE00 && r <= 0xFE0F:
    case isPrettierWide(r):
      width += 2
    default:
      width++
    }
  }
  return width
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

// displayWidthFromColumn returns the display width of s laid out starting at
// column `start`, expanding a tab to the next multiple of tabWidth. It is the
// tab-aware form the source-measuring rules need, where a literal tab in the
// file does advance to a tab stop; displayWidth itself charges a tab one column
// because the layout engine emits indentation outside the text it measures.
func displayWidthFromColumn(s string, tabWidth int, start int) int {
  if tabWidth <= 0 {
    tabWidth = 2
  }
  // Walked one tab at a time rather than by splitting, so each tab advances
  // from the column the text before it actually reached.
  column := start
  rest := s
  for {
    index := strings.IndexByte(rest, '\t')
    if index < 0 {
      column += displayWidth(rest)
      break
    }
    column += displayWidth(rest[:index])
    column += tabWidth - (column % tabWidth)
    rest = rest[index+1:]
  }
  return column - start
}

// hasNonASCII reports whether s holds a byte outside Prettier's printable-ASCII
// fast-path range, matching its `/[^\x20-\x7F]/u` test. A multi-byte rune's
// lead byte is >= 0x80, so a byte scan answers the same question.
func hasNonASCII(s string) bool {
  for i := 0; i < len(s); i++ {
    if s[i] < 0x20 || s[i] > 0x7F {
      return true
    }
  }
  return false
}

var prettierEmojiRegexp = sync.OnceValue(func() *regexp.Regexp {
  return regexp.MustCompile(prettierEmojiPattern)
})

// replacePrettierEmoji performs Prettier's emoji substitution: every RGI emoji
// becomes one space when Prettier charges it one column, two spaces otherwise.
//
// The work happens in the shifted UTF-16 domain the generated pattern is
// written against, because emoji-regex matches code units and a Go string
// cannot hold a lone surrogate. Text goes in as runes, becomes units, each
// surrogate unit moves into a private-use range, the match runs, and the result
// comes back. The mapping is a bijection over a range nothing else occupies.
func replacePrettierEmoji(s string) string {
  shifted := shiftToUTF16Domain(s)
  replaced := prettierEmojiRegexp().ReplaceAllStringFunc(shifted, func(match string) string {
    if isNarrowPrettierEmoji(match) {
      return " "
    }
    return "  "
  })
  if replaced == shifted {
    return s
  }
  return unshiftFromUTF16Domain(replaced)
}

// isNarrowPrettierEmoji reports whether a match is one of the emoji Prettier
// charges a single column. The set is single code points, so a match of any
// other length is never narrow.
func isNarrowPrettierEmoji(match string) bool {
  runes := []rune(unshiftFromUTF16Domain(match))
  return len(runes) == 1 && inUnicodeRanges(prettierNarrowEmojiRanges[:], runes[0])
}

// shiftToUTF16Domain encodes s as UTF-16 and represents each code unit as one
// rune, relocating surrogates so the result is a valid Go string.
func shiftToUTF16Domain(s string) string {
  units := utf16.Encode([]rune(s))
  out := make([]rune, 0, len(units))
  for _, unit := range units {
    r := rune(unit)
    if r >= 0xD800 && r <= 0xDFFF {
      r = r - 0xD800 + surrogateShift
    }
    out = append(out, r)
  }
  return string(out)
}

// unshiftFromUTF16Domain is shiftToUTF16Domain's inverse.
func unshiftFromUTF16Domain(s string) string {
  units := make([]uint16, 0, len(s))
  for _, r := range s {
    if r >= surrogateShift && r <= surrogateShift+0x7FF {
      r = r - surrogateShift + 0xD800
    }
    if r > 0xFFFF {
      units = append(units, utf16.Encode([]rune{r})...)
      continue
    }
    units = append(units, uint16(r))
  }
  return string(utf16.Decode(units))
}

func isPrettierWide(r rune) bool {
  return inUnicodeRanges(prettierWideRanges[:], r) ||
    inUnicodeRanges(prettierFullWidthRanges[:], r)
}

// inUnicodeRanges reports whether r falls in one of the sorted, disjoint
// ranges of a generated property table.
func inUnicodeRanges(ranges []unicodeRange, r rune) bool {
  lo, hi := 0, len(ranges)
  for lo < hi {
    middle := int(uint(lo+hi) >> 1)
    candidate := ranges[middle]
    switch {
    case r < candidate.lo:
      hi = middle
    case r > candidate.hi:
      lo = middle + 1
    default:
      return true
    }
  }
  return false
}
