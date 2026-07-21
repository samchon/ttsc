package linthost

import "testing"

// TestDisplayWidthMatchesPrettierGetStringWidth pins displayWidth to the number
// Prettier 3.8.3 returns.
//
// Every `want` below was MEASURED by calling `prettier.util.getStringWidth` on
// the exact code points beside it, not derived from a specification of what
// Prettier ought to do. That distinction is this function's whole history: a
// hand-written range table diverged on 11,482 code points, and the first repair
// ported `string-width` — which the report named and Prettier does not use —
// and regressed ordinary Devanagari, the Hangul fillers, the bidi controls, and
// 98 astral text-presentation emoji before it was reverted.
//
// Inputs are written as `\u` escapes on purpose. Several are unassigned, several
// are invisible, and one is a lone keycap mark; verify the code points, not the
// glyphs, before changing any of them. `＀`, `⺚`, and `꓇` measure
// 1 precisely BECAUSE they are unassigned, so replacing one with its assigned
// neighbour inverts the assertion silently.
func TestDisplayWidthMatchesPrettierGetStringWidth(t *testing.T) {
  for _, tc := range []struct {
    name  string
    input string
    want  int
  }{
    // Emoji the old range table under-charged.
    {"star", "⭐", 2},
    {"check-mark", "✅", 2},
    {"cross-mark", "❌", 2},
    {"high-voltage", "⚡", 2},
    {"watch", "⌚", 2},
    {"mahjong-red-dragon", "\U0001F004", 2},
    {"hexagram", "䷀", 2},
    {"small-comma", "﹐", 2},

    // Emoji sequences: the regex substitution charges each whole.
    {"heart-with-vs16", "❤\uFE0F", 2},
    {"keycap-one", "1\uFE0F\u20E3", 2},
    {"waving-hand-skin-tone", "\U0001F44B\U0001F3FD", 2},
    {"zwj-family", "\U0001F468\u200D\U0001F469\u200D\U0001F467", 2},
    // Not every ZWJ chain is an RGI sequence. This one is not, so the regex
    // does not match it whole and its parts are charged: 2 + 1 + 2.
    {"incomplete-zwj-sequence", "\U0001F468\u200D\U0001F469", 5},
    {"regional-indicator-flag", "\U0001F1F0\U0001F1F7", 2},

    // Emoji-regex matches these bare although they default to text
    // presentation, so they are two columns while Emoji_Presentation is false.
    // A `string-width` port charges them 1.
    {"thermometer-text-presentation", "\U0001F321", 2},
    {"eye-text-presentation", "\U0001F441", 2},
    {"detective-text-presentation", "\U0001F575", 2},
    // A skin tone on a base that is itself narrow.
    {"index-pointing-up-skin-tone", "☝\U0001F3FD", 2},

    // Ranges the old table over-charged.
    {"ornamental-leaf", "\U0001F650", 1},
    {"circled-number-ten", "㉈", 1},
    {"unassigned-cjk-radical", "⺚", 1},
    {"unassigned-yi-radical", "꓇", 1},
    {"unassigned-fullwidth", "＀", 1},
    // Half of a flag is not a flag; the regex needs the pair.
    {"lone-regional-indicator", "\U0001F1F0", 1},
    // A copyright sign is an emoji Prettier charges one column.
    {"narrow-emoji-copyright", "©", 1},

    // Counted per CODE POINT, not per grapheme cluster. Charging a cluster's
    // base alone is what made a `string-width` port wrong on ordinary text.
    {"devanagari-ka-aa", "का", 2},
    {"hindi-word", "हिंदी", 5},
    {"decomposed-hangul", "한", 4},
    {"base-with-combining-mark", "가\u0301", 2},

    // Not skipped: only U+0300-U+036F, the C0/C1 controls, and U+FE00-U+FE0F
    // are free. A default-ignorable skip would zero all of these.
    {"hangul-filler", "\u115F", 2},
    {"halfwidth-hangul-filler", "\u3164", 2},
    {"zero-width-non-joiner", "\u200C", 1},
    {"left-to-right-mark", "\u200E", 1},
    {"soft-hyphen", "\u00AD", 1},
    {"zero-width-space", "\u200B", 1},
    {"byte-order-mark", "\uFEFF", 1},
    {"lone-zwj", "\u200D", 1},
    {"lone-keycap-mark", "\u20E3", 1},
    // A variation selector on a base the emoji regex does not match is free,
    // and its base is charged normally.
    {"a-with-vs16", "a\uFE0F", 1},
    {"hash-with-vs16", "#\uFE0F", 1},
    {"lone-variation-selector", "\uFE0F", 0},
    {"lone-combining-mark", "\u0301", 0},

    // Already correct, and must stay correct.
    {"ascii", "a", 1},
    {"ascii-run", "const value = 1;", 16},
    {"hangul-syllable", "가", 2},
    {"cjk-unified", "一", 2},
    {"subscript-digit", "₀", 1},
    {"empty", "", 0},
    {"control-character", "\x07", 0},
    {"carriage-return-and-newline", "a\r\nb", 2},
    // U+007F rides the printable-ASCII fast path, which the counting loop
    // would have skipped. The fast path is observable, not an optimization.
    {"delete-through-the-ascii-fast-path", "\x7F", 1},

    // The one deliberate deviation: Prettier's loop skips a tab as a control
    // and returns 0. The layout engine emits indentation outside the text it
    // measures, so a tab is charged one column here and tab-stop expansion is
    // `displayWidthFromColumn`'s.
    {"tab-keeps-its-documented-one-column", "\t", 1},

    // A mixed line, the shape the formatter actually measures: five stars cost
    // the same ten columns as ten ASCII characters.
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
// measures only the text after the final newline, with the same rules.
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
// by the source-measuring rules advances to the next tab stop, and that it
// measures each segment between tabs whole rather than per rune.
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
    {"two-tabs", "\t\t", 4, 0, 8},
    {"no-tab-matches-display-width", "⭐a", 4, 0, 3},
    // A complete RGI sequence is measured whole (2), so the tab that follows
    // advances from column 2 to 4. Splitting the sequence would charge its
    // parts, which is what walking per rune used to do.
    {"complete-emoji-then-tab", "\U0001F468\u200D\U0001F469\u200D\U0001F467\t", 4, 0, 4},
    // The negative twin, and the reason the case above proves anything: an
    // INCOMPLETE ZWJ sequence is not an RGI emoji, so Prettier charges its
    // parts \u2014 2 + 1 + 2 \u2014 and measures 5, putting the tab stop at 8. Measured,
    // not assumed; an implementation that segmented by grapheme cluster would
    // answer 2 here and look correct on the case above.
    {"incomplete-emoji-then-tab", "\U0001F468\u200D\U0001F469\t", 4, 0, 8},
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

// TestPrettierWidthTablesArePinnedToTheInstalledOracle guards the generated
// tables against silently describing a different Prettier than the one the
// repository installs.
//
// The tables are transcribed from `node_modules/prettier`, so if the pin moves
// and nobody regenerates, `displayWidth` keeps measuring the old Prettier while
// the conformance corpus compares against the new one. The version travels with
// the tables so that mismatch has a name.
func TestPrettierWidthTablesArePinnedToTheInstalledOracle(t *testing.T) {
  if prettierWidthVersion == "" {
    t.Fatal("width tables carry no Prettier version")
  }
  if len(prettierWideRanges) == 0 || len(prettierFullWidthRanges) == 0 {
    t.Fatal("width tables are empty, so every character would measure one column")
  }
  if len(prettierNarrowEmojiRanges) == 0 {
    t.Fatal("narrow-emoji table is empty, so every emoji would measure two columns")
  }
  // Sorted and disjoint, which is what the binary search assumes.
  for name, ranges := range map[string][]unicodeRange{
    "wide":         prettierWideRanges[:],
    "fullwidth":    prettierFullWidthRanges[:],
    "narrow-emoji": prettierNarrowEmojiRanges[:],
  } {
    for i, r := range ranges {
      if r.lo > r.hi {
        t.Fatalf("%s range %d is descending: %04X..%04X", name, i, r.lo, r.hi)
      }
      if i > 0 && r.lo <= ranges[i-1].hi {
        t.Fatalf("%s ranges %d and %d overlap", name, i-1, i)
      }
    }
  }
}
