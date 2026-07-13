// Grapheme-cluster string length, mirroring typescript-eslint's
// `getStringLength` util (which counts `Intl.Segmenter` grapheme segments,
// not UTF-16 code units). `typescript/ban-ts-comment` measures directive
// descriptions with it so that a single emoji — even a multi-code-point
// ZWJ sequence like a family emoji — counts as one character, exactly as
// the upstream rule and its regression tests define.
//
// Like display_width.go, this hand-rolls the Unicode logic instead of
// pulling in a segmentation dependency. It implements the UAX #29
// extended-grapheme-cluster rules that occur in real comment text:
// CR LF (GB3), Hangul jamo composition (GB6–GB8), Extend and SpacingMark
// continuation (GB9/GB9a), emoji ZWJ sequences (GB9/GB11), and regional
// indicator pairing (GB12/GB13). Prepend (GB9b) is omitted — the class
// covers a handful of rare Indic/Arabic signs that do not meaningfully
// change a description-length gate.
package linthost

import "unicode"

// stringLength returns the number of grapheme clusters in s. ASCII-only
// strings short-circuit to the byte length, matching the upstream helper.
func stringLength(s string) int {
  if isASCIIOnly(s) {
    return len(s)
  }
  return graphemeCount(s)
}

// isASCIIOnly reports whether every byte of s is < 0x80. For such strings
// bytes, runes, and grapheme clusters all coincide.
func isASCIIOnly(s string) bool {
  for i := 0; i < len(s); i++ {
    if s[i] >= 0x80 {
      return false
    }
  }
  return true
}

// graphemeCount walks s cluster by cluster and counts boundaries.
func graphemeCount(s string) int {
  runes := []rune(s)
  count := 0
  for i := 0; i < len(runes); {
    count++
    i = nextGraphemeBoundary(runes, i)
  }
  return count
}

// nextGraphemeBoundary returns the index just past the grapheme cluster
// starting at runes[start].
func nextGraphemeBoundary(runes []rune, start int) int {
  first := runes[start]
  i := start + 1

  // GB3: CR LF is a single cluster. GB4: other controls stand alone.
  if first == '\r' && i < len(runes) && runes[i] == '\n' {
    return i + 1
  }
  if isGraphemeControl(first) {
    return i
  }

  // GB12/GB13: regional indicators join in pairs (flag emoji), so a run
  // of four RIs is two flags, not one cluster.
  if isRegionalIndicator(first) && i < len(runes) && isRegionalIndicator(runes[i]) {
    i++
  }

  for i < len(runes) {
    cur := runes[i]
    prev := runes[i-1]
    switch {
    case isGraphemeControl(cur):
      return i
    case cur == graphemeZWJ || isGraphemeExtend(cur):
      // GB9/GB9a: Extend, ZWJ, and SpacingMark continue the cluster.
      i++
    case prev == graphemeZWJ && isExtendedPictographic(cur) && isExtendedPictographic(first):
      // GB11: an emoji ZWJ sequence (pictograph ZWJ pictograph ...)
      // stays one cluster; ZWJ between non-pictographs still breaks.
      i++
    case isHangulJoin(prev, cur):
      // GB6–GB8: conjoining jamo compose into one syllable cluster.
      i++
    default:
      return i
    }
  }
  return i
}

const graphemeZWJ = 0x200D

// isGraphemeControl reports GB4/GB5 Control-class runes: line/paragraph
// separators and the C0/C1 control blocks.
func isGraphemeControl(r rune) bool {
  return r == '\r' || r == '\n' || r == 0x2028 || r == 0x2029 ||
    r < 0x20 || (r >= 0x7F && r <= 0x9F)
}

// isGraphemeExtend reports runes that extend the current cluster:
// combining marks (Mn/Me), spacing marks (Mc, GB9a), the zero-width
// non-joiner, and the emoji skin-tone modifiers (Emoji_Modifier is
// Extend in UAX #29 even though its general category is Sk).
func isGraphemeExtend(r rune) bool {
  if unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r) || unicode.Is(unicode.Mc, r) {
    return true
  }
  return r == 0x200C || (r >= 0x1F3FB && r <= 0x1F3FF)
}

// isRegionalIndicator reports the 26 regional-indicator symbols that pair
// into flag emoji.
func isRegionalIndicator(r rune) bool {
  return r >= 0x1F1E6 && r <= 0x1F1FF
}

// isExtendedPictographic approximates the Extended_Pictographic property
// over the blocks real emoji ZWJ sequences draw from: the SMP emoji and
// symbol planes plus the BMP symbol blocks promoted to emoji.
func isExtendedPictographic(r rune) bool {
  switch {
  case r >= 0x1F000 && r <= 0x1FBFF, // Mahjong .. Symbols for Legacy Computing
    r >= 0x2600 && r <= 0x27BF,            // Miscellaneous Symbols, Dingbats
    r >= 0x2B00 && r <= 0x2BFF,            // Miscellaneous Symbols and Arrows
    r >= 0x2190 && r <= 0x21FF,            // Arrows (⬆ style ZWJ sequences)
    r == 0x00A9, r == 0x00AE, r == 0x2122, // ©, ®, ™
    r >= 0x2300 && r <= 0x23FF: // Miscellaneous Technical (⌚, ⏰, …)
    return true
  }
  return false
}

// isHangulJoin reports the GB6–GB8 conjoining-jamo joins:
// L × (L|V|LV|LVT), (LV|V) × (V|T), and (LVT|T) × T.
func isHangulJoin(prev, cur rune) bool {
  switch hangulClass(prev) {
  case hangulL:
    c := hangulClass(cur)
    return c == hangulL || c == hangulV || c == hangulLV || c == hangulLVT
  case hangulLV, hangulV:
    c := hangulClass(cur)
    return c == hangulV || c == hangulT
  case hangulLVT, hangulT:
    return hangulClass(cur) == hangulT
  }
  return false
}

type hangulSyllableClass int

const (
  hangulNone hangulSyllableClass = iota
  hangulL
  hangulV
  hangulT
  hangulLV
  hangulLVT
)

// hangulClass returns the UAX #29 Hangul syllable class of r.
func hangulClass(r rune) hangulSyllableClass {
  switch {
  case (r >= 0x1100 && r <= 0x115F) || (r >= 0xA960 && r <= 0xA97C):
    return hangulL
  case (r >= 0x1160 && r <= 0x11A7) || (r >= 0xD7B0 && r <= 0xD7C6):
    return hangulV
  case (r >= 0x11A8 && r <= 0x11FF) || (r >= 0xD7CB && r <= 0xD7FB):
    return hangulT
  case r >= 0xAC00 && r <= 0xD7A3:
    if (r-0xAC00)%28 == 0 {
      return hangulLV
    }
    return hangulLVT
  }
  return hangulNone
}
