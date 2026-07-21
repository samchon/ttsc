package linthost

import "unicode/utf8"

// displayWidth returns the number of terminal columns a string occupies,
// matching Prettier's getStringWidth. Width decisions across the formatter —
// the layout engine's fit checks and the print-width rule's source measurement
// — must use display columns rather than byte length, or a multi-byte token (a
// subscript digit, a Hangul or CJK identifier) is over-counted and the line is
// wrongly broken.
//
// The contract is computed, not approximated. Prettier delegates to
// `string-width`, which segments text into extended grapheme clusters, charges
// an emoji cluster two columns whole, and otherwise charges by the
// East_Asian_Width of the cluster's base code point. This mirrors that
// procedure over the same Unicode 16.0.0 property data the grapheme segmenter
// already generates, so a ZWJ sequence, a skin-tone sequence, and a keycap
// each cost two columns rather than one charge per code point, and the wide
// set is the published property rather than a hand-written range list.
//
// One deviation is deliberate and predates this: a tab counts as one column
// here, where Prettier counts zero. Callers that need tab-stop expansion
// handle it separately (the layout engine emits indentation outside of Text
// nodes, so an embedded tab is rare and was already charged as one byte before
// this). Every other control character costs nothing, as it does there.
func displayWidth(s string) int {
  width := 0
  forEachGraphemeCluster(s, func(cluster string) {
    width += clusterWidth(cluster)
  })
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

// displayWidthFromColumn returns the display width of s when it is laid out
// starting at column `start`, expanding a tab to the next multiple of
// tabWidth. It is the tab-aware form the source-measuring rules need, where a
// literal tab in the file does advance to a tab stop; displayWidth itself
// charges a tab one column because the layout engine emits indentation outside
// the text it measures.
func displayWidthFromColumn(s string, tabWidth int, start int) int {
  if tabWidth <= 0 {
    tabWidth = 2
  }
  column := start
  forEachGraphemeCluster(s, func(cluster string) {
    if cluster == "\t" {
      column += tabWidth - (column % tabWidth)
      return
    }
    column += clusterWidth(cluster)
  })
  return column - start
}

// clusterWidth returns the column width of one extended grapheme cluster: zero
// for a cluster that renders nothing, two for an emoji or East Asian Wide /
// Fullwidth cluster, one otherwise.
//
// The width of a non-emoji cluster comes from its base code point alone, which
// is what makes a combining mark free: `가` followed by a mark is two columns,
// not two plus the mark.
func clusterWidth(cluster string) int {
  base, size := utf8.DecodeRuneInString(cluster)
  if size == 0 {
    return 0
  }
  switch {
  case base == '\t':
    // The documented deviation, kept so tab-stop expansion stays the caller's.
    return 1
  case base <= 0x1F, base >= 0x7F && base <= 0x9F:
    return 0
  case base >= 0x200B && base <= 0x200F, base == 0xFEFF:
    return 0
  case base >= 0x0300 && base <= 0x036F:
    return 0
  }
  // A lone default-ignorable code point renders nothing. Tested on the whole
  // cluster, so a variation selector or ZWJ that is part of a larger cluster
  // is charged through that cluster instead of vanishing.
  if size == len(cluster) && isDefaultIgnorable(base) {
    return 0
  }
  if isEmojiCluster(cluster, base) {
    return 2
  }
  if isEastAsianWide(base) {
    return 2
  }
  return 1
}

// isEmojiCluster reports whether a cluster renders as an emoji, the case
// `string-width` charges two columns whole regardless of its code points'
// individual widths.
//
// A cluster qualifies when its base code point defaults to emoji presentation,
// when it carries the emoji variation selector U+FE0F, when it encloses a
// keycap, or when it is a regional-indicator pair (a flag). Sequences built on
// those bases — skin tone, ZWJ family, tag — are already one cluster by UAX
// #29, so they need no rule of their own.
func isEmojiCluster(cluster string, base rune) bool {
  if hasEmojiPresentation(base) {
    return true
  }
  if isRegionalIndicator(base) {
    for _, r := range cluster[utf8.RuneLen(base):] {
      if isRegionalIndicator(r) {
        return true
      }
    }
    return false
  }
  for _, r := range cluster {
    // U+FE0F requests emoji presentation; U+20E3 makes the base a keycap.
    if r == 0xFE0F || r == 0x20E3 {
      return true
    }
  }
  return false
}

func isRegionalIndicator(r rune) bool {
  return r >= 0x1F1E6 && r <= 0x1F1FF
}

func hasEmojiPresentation(r rune) bool {
  return inUnicodeRanges(emojiPresentationRanges[:], r)
}

func isDefaultIgnorable(r rune) bool {
  return inUnicodeRanges(defaultIgnorableRanges[:], r)
}

func isEastAsianWide(r rune) bool {
  return inUnicodeRanges(eastAsianWideRanges[:], r)
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
