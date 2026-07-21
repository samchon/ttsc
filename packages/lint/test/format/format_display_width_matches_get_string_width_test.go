package linthost

import "testing"

// TestDisplayWidthMatchesGetStringWidth pins displayWidth to the contract its
// doc comment and `website/src/content/docs/lint/format.mdx` publish: the
// column count Prettier 3.8.3's `getStringWidth` returns.
//
// The previous implementation summed a per-code-point width from a hand-written
// 13-range table, which is neither the East_Asian_Width property nor Prettier's
// emoji set, and did no grapheme clustering. Every expectation here is one of
// the divergences measured against the pinned oracle in the report, so a
// regression to a range list fails on the same witnesses that exposed it.
//
// Several inputs are unassigned code points that no font renders, and several
// others are invisible (a combining mark, ZWJ, a variation selector). Verify
// the code points, not the glyphs, before changing any of them: U+2E9A,
// U+A4C7, and U+FF00 are narrow precisely BECAUSE they are unassigned, so
// replacing one with its assigned neighbour inverts the assertion silently.
func TestDisplayWidthMatchesGetStringWidth(t *testing.T) {
  for _, tc := range []struct {
    name  string
    input string
    want  int
  }{
    // Under-counted by the range table: emoji below U+1F300 and CJK blocks the
    // list never named.
    {"star", "⭐", 2},
    {"check-mark", "✅", 2},
    {"cross-mark", "❌", 2},
    {"high-voltage", "⚡", 2},
    {"watch", "⌚", 2},
    {"mahjong-red-dragon", "\U0001F004", 2},
    {"hexagram", "䷀", 2},
    {"small-comma", "﹐", 2},

    // No clustering: each of these is one extended grapheme cluster and costs
    // two columns whole, not one charge per code point.
    {"heart-with-vs16", "❤️", 2},
    {"keycap-one", "1️⃣", 2},
    {"waving-hand-skin-tone", "\U0001F44B\U0001F3FD", 2},
    {"family-zwj-sequence", "\U0001F468‍\U0001F469‍\U0001F467", 2},
    {"regional-indicator-flag", "\U0001F1F0\U0001F1F7", 2},

    // Over-counted by the range table: Extended_Pictographic without emoji
    // presentation, an ambiguous-width block, and three unassigned code points
    // the East_Asian_Width file does not list.
    {"ornamental-leaf", "\U0001F650", 1},
    {"circled-number-ten-on-black-square", "㉈", 1},
    {"unassigned-cjk-radical", "⺚", 1},
    {"unassigned-yi-radical", "꓇", 1},
    {"unassigned-fullwidth", "＀", 1},

    // Already correct, and must stay correct.
    {"ascii", "a", 1},
    {"ascii-run", "const value = 1;", 16},
    {"hangul-syllable", "가", 2},
    {"cjk-unified", "一", 2},
    {"subscript-digit", "₀", 1},

    // Boundaries.
    {"empty", "", 0},
    {"lone-combining-mark", "́", 0},
    {"lone-zwj", "‍", 0},
    {"lone-variation-selector", "️", 0},
    {"base-with-combining-mark", "가́", 2},
    {"tab-keeps-its-documented-one-column", "\t", 1},
    {"control-character", "\x07", 0},
    {"zero-width-space", "​", 0},
    // Written as an escape because Go's scanner rejects a literal U+FEFF
    // anywhere but the first byte of a file.
    {"byte-order-mark", "\uFEFF", 0},

    // A mixed line, the shape the formatter actually measures. Five stars cost
    // the same ten columns as ten ASCII characters, which is the break
    // decision the report showed diverging.
    {"mixed-line", "fn(\"⭐⭐⭐⭐⭐\", 1);", 20},
  } {
    t.Run(tc.name, func(t *testing.T) {
      if got := displayWidth(tc.input); got != tc.want {
        t.Fatalf("displayWidth(%q) = %d, want %d", tc.input, got, tc.want)
      }
    })
  }
}

// TestDisplayWidthAfterLastNewlineMeasuresTail verifies the column-reset helper
// measures only the text after the final newline, with the same cluster rules.
func TestDisplayWidthAfterLastNewlineMeasuresTail(t *testing.T) {
  for _, tc := range []struct {
    name  string
    input string
    want  int
  }{
    {"no-newline", "⭐", 2},
    {"tail-after-newline", "aaaa\n⭐⭐", 4},
    {"empty-tail", "aaaa\n", 0},
    {"crlf-tail", "aaaa\r\nab", 2},
  } {
    t.Run(tc.name, func(t *testing.T) {
      if got := displayWidthAfterLastNewline(tc.input); got != tc.want {
        t.Fatalf("displayWidthAfterLastNewline(%q) = %d, want %d", tc.input, got, tc.want)
      }
    })
  }
}

// TestDisplayWidthFromColumnExpandsTabsToStops verifies the tab-aware form used
// by the source-measuring rules advances to the next tab stop rather than
// charging the flat one column displayWidth uses.
func TestDisplayWidthFromColumnExpandsTabsToStops(t *testing.T) {
  for _, tc := range []struct {
    name   string
    input  string
    width  int
    start  int
    expect int
  }{
    {"tab-at-column-zero", "\t", 4, 0, 4},
    {"tab-mid-stop", "ab\t", 4, 0, 4},
    {"tab-from-offset-start", "\t", 4, 3, 1},
    {"wide-then-tab", "가\t", 4, 0, 4},
    {"no-tab-matches-display-width", "⭐a", 4, 0, 3},
    {"zero-tab-width-falls-back", "\t", 0, 0, 2},
  } {
    t.Run(tc.name, func(t *testing.T) {
      got := displayWidthFromColumn(tc.input, tc.width, tc.start)
      if got != tc.expect {
        t.Fatalf(
          "displayWidthFromColumn(%q, %d, %d) = %d, want %d",
          tc.input, tc.width, tc.start, got, tc.expect,
        )
      }
    })
  }
}

// TestForEachGraphemeClusterAgreesWithGraphemeCount verifies the cluster walk
// and the cluster count read the same boundaries, and that the clusters
// partition the input.
//
// displayWidth charges per cluster and stringLength counts clusters; if the two
// ever segmented differently, a width could be attributed to a cluster the
// directive-length rule does not believe exists.
func TestForEachGraphemeClusterAgreesWithGraphemeCount(t *testing.T) {
  for _, input := range []string{
    "",
    "a",
    "const value = 1;",
    "가́",
    "\U0001F468‍\U0001F469‍\U0001F467",
    "\U0001F1F0\U0001F1F7\U0001F1EF\U0001F1F5",
    "a\r\nb",
    "क्‍ष",
  } {
    var seen []string
    forEachGraphemeCluster(input, func(cluster string) {
      seen = append(seen, cluster)
    })
    if want := graphemeCount(input); len(seen) != want {
      t.Fatalf("forEachGraphemeCluster(%q) yielded %d clusters, graphemeCount says %d", input, len(seen), want)
    }
    joined := ""
    for _, cluster := range seen {
      joined += cluster
    }
    if joined != input {
      t.Fatalf("clusters of %q rejoin to %q", input, joined)
    }
  }
}
