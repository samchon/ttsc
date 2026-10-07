package linthost

import "testing"

// TestDisplayWidthFromColumnExpandsTabsToStops verifies the tab-aware form used
// by the source-measuring rules advances to the next tab stop, and that it
// measures each segment between tabs whole rather than per rune.
//
// @evidence contracts/testing.md#behavioral-verification displayWidthFromColumn must advance tabs to the next configured stop while measuring emoji sequences whole between tabs.
// @evidence contracts/testing.md#independent-expectations Literal tab-stop arithmetic and the independently measured complete/incomplete emoji widths establish the expected four/eight-column outcomes.
// @evidence contracts/testing.md#distinguishing-cases Named cases cover zero and offset starts, existing text, wide text, two tabs, complete/incomplete ZWJ twins, no tab and zero-width default.
// @evidence contracts/testing.md#execution-ownership TestDisplayWidthFromColumnExpandsTabsToStops is a top-level Go unit selected by the Go tests Evidence claim. Its nine named t.Run cases call displayWidthFromColumn directly in-process; it installs no consumer, builds no native artifact and starts no formatter child or product host.
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
    // parts (2 + 1 + 2) and measures 5, putting the tab stop at 8. Measured,
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
