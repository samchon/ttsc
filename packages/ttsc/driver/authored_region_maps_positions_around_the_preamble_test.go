package driver

import "testing"

// TestAuthoredRegionMapsPositionsAroundThePreamble verifies the source-map
// region adapter on sampled positions in four literal preamble-bearing texts.
// It restores authored text, rejects the inside probe, maps the after probe,
// and preserves the hashbang fixture's before probe.
//
// A preamble is parsed as part of the file, so a map printed from the Program
// records positions in the preamble-bearing text. ApplySourcePreamble inserts
// it after a BOM and after a hashbang line, and a preamble need not end a line,
// so a fixed line shift would be wrong for all but the plainest case.
//
//  1. Insert a preamble into plain, CRLF hashbang, BOM, and open-line literal texts.
//  2. Assert the authored text is the original, positions before the preamble
//     stay, positions inside it drop, and positions after it land on the same
//     authored character.
//
// @evidence contracts/testing.md#behavioral-verification Over four literal fixtures, authored text is restored, the sampled inside position is rejected, and the sampled after position maps to its literal authored coordinate; the hashbang fixture also checks one unchanged before position. Other coordinates, Unicode cases, and emitted source-map integration are not certified.
// @evidence contracts/testing.md#independent-expectations The authored text and the expected line and column of each probe are literals written next to each input, not recomputed by the mapping.
// @evidence contracts/testing.md#distinguishing-cases A plain file, a CRLF hashbang file, a BOM file and a preamble that does not end a line each place the preamble differently, so a fixed line shift fails all but the plainest case.
// @evidence contracts/testing.md#execution-ownership This Go unit calls ApplySourcePreamble and the private region adapter in-process over literal text and an opaque filename. It creates no native file or compiler Program and starts no consumer or product process; emitted source-map rewriting is not exercised.
func TestAuthoredRegionMapsPositionsAroundThePreamble(t *testing.T) {
  type position struct{ line, column int }
  cases := []struct {
    name     string
    authored string
    preamble string
    // before is a position ahead of the preamble, if the file has one.
    before *position
    // inside is a parsed position within the preamble.
    inside position
    // after maps a parsed position of `value` to its authored position.
    after, authoredAfter position
  }{
    {
      name:          "plain",
      authored:      "export const value = 1;\n",
      preamble:      "// one\n// two\n",
      inside:        position{1, 3},
      after:         position{2, 13},
      authoredAfter: position{0, 13},
    },
    {
      name:          "crlf hashbang",
      authored:      "#!/usr/bin/env node\r\nexport const value = 1;\r\n",
      preamble:      "// banner\n",
      before:        &position{0, 5},
      inside:        position{1, 0},
      after:         position{2, 13},
      authoredAfter: position{1, 13},
    },
    {
      name:          "bom",
      authored:      "\ufeffexport const value = 1;\n",
      preamble:      "// banner\n",
      inside:        position{0, 2},
      after:         position{1, 13},
      authoredAfter: position{0, 14},
    },
    {
      name:          "open line",
      authored:      "export const value = 1;\n",
      preamble:      "/* banner */ ",
      inside:        position{0, 4},
      after:         position{0, 26},
      authoredAfter: position{0, 13},
    },
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      parsed := ApplySourcePreamble(c.authored, c.preamble)
      region := newAuthoredRegion("/project/src/main.ts", parsed, c.preamble)
      if region == nil {
        t.Fatalf("no region for %q", parsed)
      }
      if region.text != c.authored {
        t.Fatalf("authored text = %q, want %q", region.text, c.authored)
      }
      if c.before != nil {
        if line, column, ok := region.authoredPosition(c.before.line, c.before.column); !ok || line != c.before.line || column != c.before.column {
          t.Fatalf("before the preamble: got %d:%d ok=%v", line, column, ok)
        }
      }
      if _, _, ok := region.authoredPosition(c.inside.line, c.inside.column); ok {
        t.Fatalf("a position inside the preamble was kept")
      }
      line, column, ok := region.authoredPosition(c.after.line, c.after.column)
      if !ok || line != c.authoredAfter.line || column != c.authoredAfter.column {
        t.Fatalf("after the preamble: got %d:%d ok=%v, want %d:%d", line, column, ok, c.authoredAfter.line, c.authoredAfter.column)
      }
    })
  }
}
